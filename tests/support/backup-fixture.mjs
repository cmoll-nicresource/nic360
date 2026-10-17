import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
const fixture = JSON.parse(await fs.readFile('.test-artifacts/fixtures.json', 'utf8'))
const snapshot = 'uploads/' + new Date().toISOString().replaceAll(/[-:.]/g, '')
const directory = path.join('.test-artifacts/backup-archive', snapshot)
await fs.mkdir(path.join(directory, 'objects'), { recursive: true })
const manifest = []
for (const file of Object.values(fixture.files)) {
  if (!/^e2e-[a-f0-9-]+\.pdf$/.test(file.filename)) throw new Error('Only synthetic files may be copied')
  const bytes = await fs.readFile(path.join('guide-files', file.filename))
  await fs.writeFile(path.join(directory, 'objects', file.filename), bytes)
  manifest.push({ Path: file.filename, Size: bytes.length, Hashes: { md5: crypto.createHash('md5').update(bytes).digest('hex') } })
}
await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest))
await fs.writeFile(path.join(directory, 'complete.json'), JSON.stringify({ snapshot, completedAt: new Date().toISOString() }))
