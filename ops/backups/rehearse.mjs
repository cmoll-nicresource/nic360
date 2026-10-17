import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { latest as remoteLatest, getBytes as remoteBytes, assertFresh, recordRecovery, alert } from './health.mjs'
import { verifyUploads, recoveredPath } from './verify-uploads.mjs'

const docker = process.env.DOCKER_BIN || 'docker'
// The local smoke uses invented fixtures and never contacts AWS or publishes recovery evidence.
const local = process.env.RECOVERY_LOCAL_DIRECTORY
const getBytes = key => local ? fs.readFile(recoveredPath(local, key)) : remoteBytes(key)
async function latest(prefix, maxHours) {
  if (!local) return remoteLatest(prefix, maxHours)
  const entries = (await fs.readdir(path.join(local, prefix))).sort().reverse()
  for (const entry of entries) {
    const key = prefix + entry + '/complete.json'
    try {
      const marker = JSON.parse((await getBytes(key)).toString())
      assertFresh(marker, maxHours)
      if (marker.snapshot !== prefix + entry) throw new Error('Local snapshot marker mismatch')
      return marker
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  throw new Error('Missing synthetic snapshot')
}
const name = 'nic360-recovery-' + crypto.randomUUID()
const password = crypto.randomBytes(24).toString('hex')
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'nic360-recovery-'))
let created = false
const run = (args, input) => {
  const result = spawnSync(docker, args, { input, encoding: input instanceof Buffer ? undefined : 'utf8', env: { ...process.env, POSTGRES_PASSWORD: password }, maxBuffer: 64 * 1024 * 1024, timeout: 180000 })
  if (result.status !== 0) {
    const phase = args.find(value => ['pg_restore', 'createdb', 'psql'].includes(value)) || args[0]
    // Only the first error line: never emit SQL, COPY rows, or following DETAIL/CONTEXT.
    const line = result.stderr?.toString().split(/\r?\n/).find(value => /error:|ERROR:|FATAL:/.test(value)) || ''
    const safe = line.replace(/'[^']*'/g, "'[redacted]'").replace(/[\w.+-]+@[\w.-]+/g, '[redacted-email]').slice(0, 350)
    throw new Error('Isolated recovery command failed: ' + phase + (safe ? ' — ' + safe : ''))
  }
  return result.stdout
}
try {
  const start = Date.now()
  const database = await latest('database-daily/', 30)
  const uploads = await latest('uploads/', 30)
  const archive = await getBytes(database.snapshot + '/database.dump')
  const fingerprints = await getBytes(database.snapshot + '/fingerprints.jsonl')
  const sums = (await getBytes(database.snapshot + '/SHA256SUMS')).toString()
  for (const [file, bytes] of [['database.dump', archive], ['fingerprints.jsonl', fingerprints]]) {
    const hash = crypto.createHash('sha256').update(bytes).digest('hex')
    if (!sums.split(/\r?\n/).includes(hash + '  ' + file)) throw new Error('Recovery archive SHA-256 mismatch')
  }
  run(['run', '--detach', '--name', name, '--network', 'none', '--env', 'POSTGRES_PASSWORD', 'postgres:18@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336'])
  created = true
  for (let attempt = 0; ; attempt++) {
    // The image briefly starts a socket-only initialization server; wait for the final TCP server.
    if (spawnSync(docker, ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status === 0) break
    if (attempt >= 60) throw new Error('Isolated database did not start')
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  run(['exec', name, 'createdb', '-U', 'postgres', 'nic360_recovery'])
  run(['exec', '-i', name, 'pg_restore', '-U', 'postgres', '-d', 'nic360_recovery', '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction'], archive)
  const restored = run(['exec', '-i', name, 'psql', '-X', '-U', 'postgres', '-d', 'nic360_recovery', '-v', 'ON_ERROR_STOP=1'], await fs.readFile('ops/backups/database-fingerprints.sql'))
  const parse = bytes => bytes.toString().split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line))
  const byTable = (a, b) => a.table.localeCompare(b.table)
  const expected = parse(fingerprints).sort(byTable), actual = parse(restored).sort(byTable)
  if (expected.length < 50 || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Restored database fingerprints differ from the exported snapshot')
  const manifest = JSON.parse((await getBytes(uploads.snapshot + '/manifest.json')).toString())
  if (!Array.isArray(manifest) || !manifest.some(item => !item.IsDir)) throw new Error('Empty or invalid upload snapshot manifest')
  const root = path.join(work, 'uploads')
  await fs.mkdir(root)
  for (const item of manifest) {
    if (item.IsDir) continue
    const target = recoveredPath(root, item.Path)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, await getBytes(uploads.snapshot + '/objects/' + item.Path), { mode: 0o600 })
  }
  const files = await verifyUploads(root, manifest)
  // A complete recovery must also satisfy every CMS file reference. Pre-existing missing
  // prototype assets are content defects to resolve explicitly, never silently allowlisted.
  const references = run(['exec', name, 'psql', '-X', '-U', 'postgres', '-d', 'nic360_recovery', '-At', '-c', "SELECT json_build_object('collection','media','id',id,'filename',filename) FROM media WHERE filename IS NOT NULL UNION ALL SELECT json_build_object('collection','guide_files','id',id,'filename',filename) FROM guide_files WHERE filename IS NOT NULL"])
  const paths = new Set(manifest.filter(item => !item.IsDir).map(item => item.Path))
  const missing = []
  for (const ref of parse(references)) {
    if (!paths.has(ref.filename)) missing.push({ collection: ref.collection, id: ref.id, filename: ref.filename })
  }
  if (missing.length) {
    console.log(JSON.stringify({ databaseRestored: true, stableTablesMatched: actual.length, uploadedObjectsVerified: files.objects, missingAttachmentReferences: missing.length }))
    throw new Error('Restored CMS attachments are missing from the upload snapshot: ' + JSON.stringify(missing))
  }
  const summary = { database: database.snapshot, uploads: uploads.snapshot, tables: actual.length, objects: files.objects, bytes: files.bytes, durationSeconds: Math.round((Date.now() - start) / 1000), network: 'none' }
  if (!local) await recordRecovery(summary)
  console.log(JSON.stringify({ recovered: true, ...summary }))
} catch (error) {
  if (!local) await alert(error.message).catch(() => {})
  console.error(error.message)
  process.exitCode = 1
} finally {
  let cleanupError
  try { if (created) run(['rm', '--force', '--volumes', name]) } catch (error) { cleanupError = error }
  const resolved = path.resolve(work)
  if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('nic360-recovery-')) throw new Error('Unexpected recovery cleanup path')
  await fs.rm(resolved, { recursive: true, force: true })
  if (cleanupError) throw cleanupError
}
