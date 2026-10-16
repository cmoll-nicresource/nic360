import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function recoveredPath(root, key) {
  if (!key || key.includes('\\') || key.includes('\0') || key.split('/').includes('..') || path.isAbsolute(key))
    throw new Error('Unsafe object key in backup manifest')
  const target = path.resolve(root, key)
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Object escapes recovery directory')
  return target
}

export async function verifyUploads(root, manifest) {
  let objects = 0, bytes = 0
  for (const item of manifest) {
    if (item.IsDir) continue
    const target = recoveredPath(root, item.Path)
    const stat = await fs.lstat(target)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== item.Size)
      throw new Error(`Recovered file size/type mismatch: ${item.Path}`)
    // Reject symlinked parent directories as well as unsafe manifest paths.
    const real = await fs.realpath(target)
    const realRoot = await fs.realpath(root)
    if (!real.startsWith(realRoot + path.sep)) throw new Error('Recovered file escapes root through a symlink')
    const expected = item.Hashes?.md5 || item.Hashes?.MD5
    if (!expected || !/^[a-f0-9]{32}$/i.test(expected)) throw new Error(`Missing MD5 in source manifest: ${item.Path}`)
    const hash = crypto.createHash('md5')
    for await (const chunk of createReadStream(target)) hash.update(chunk)
    if (hash.digest('hex').toLowerCase() !== expected.toLowerCase()) throw new Error(`Recovered file checksum mismatch: ${item.Path}`)
    objects++
    bytes += stat.size
  }
  return { objects, bytes, checks: ['file presence', 'byte size', 'source MD5', 'safe recovery paths'] }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [root, manifestPath] = process.argv.slice(2)
  if (!root || !manifestPath) throw new Error('Usage: node ops/backups/verify-uploads.mjs RECOVERED_OBJECTS MANIFEST_JSON')
  console.log(JSON.stringify(await verifyUploads(root, JSON.parse(await fs.readFile(manifestPath, 'utf8')))))
}
