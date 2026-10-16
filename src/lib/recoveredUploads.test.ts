import { expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
// Plain Node tool also runs without installing the web application's dependencies.
import { recoveredPath, verifyUploads } from '../../ops/backups/verify-uploads.mjs'

it('rejects traversal and absolute manifest paths before touching files', () => {
  for (const key of [
    '../outside',
    '/outside',
    'nested/../../outside',
    'nested\\outside',
    'bad\0key',
  ])
    expect(() => recoveredPath('/restore', key)).toThrow()
})
it('detects missing, truncated and same-size corrupted recovered files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nic360-recovery-test-'))
  const target = path.join(root, 'proof.txt')
  const item = {
    Path: 'proof.txt',
    Size: 4,
    Hashes: { md5: crypto.createHash('md5').update('good').digest('hex') },
  }
  try {
    await expect(verifyUploads(root, [item])).rejects.toThrow()
    await fs.writeFile(target, 'bad')
    await expect(verifyUploads(root, [item])).rejects.toThrow('size')
    await fs.writeFile(target, 'evil')
    await expect(verifyUploads(root, [item])).rejects.toThrow('checksum')
    await fs.writeFile(target, 'good')
    expect(await verifyUploads(root, [item])).toMatchObject({ objects: 1, bytes: 4 })
  } finally {
    await fs.unlink(target).catch(() => undefined)
    await fs.rmdir(root)
  }
})
