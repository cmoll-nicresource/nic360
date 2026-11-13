import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { POSTGRES_IMAGE } from './postgres-image.mjs'

test('backup, isolated restore and CI source databases use the same immutable Postgres release', async () => {
  assert.match(POSTGRES_IMAGE, /^postgres:\d+\.\d+@sha256:[a-f0-9]{64}$/)
  const dockerfile = await readFile(new URL('./Dockerfile', import.meta.url), 'utf8')
  assert.equal(dockerfile.match(/^FROM (postgres:\S+)$/m)?.[1], POSTGRES_IMAGE)
  const workflow = await readFile(new URL('../../.github/workflows/checks.yml', import.meta.url), 'utf8')
  const sources = [...workflow.matchAll(/^\s+image: (postgres:\S+)$/gm)].map(match => match[1])
  assert.equal(sources.length, 2, 'Both integration and browser databases must be version-pinned')
  for (const source of sources) assert.equal(source, POSTGRES_IMAGE)
  const rehearsal = await readFile(new URL('./rehearse.mjs', import.meta.url), 'utf8')
  assert.match(rehearsal, /import \{ POSTGRES_IMAGE \} from '\.\/postgres-image\.mjs'/)
  assert.doesNotMatch(rehearsal, /postgres:\d/, 'Restore must use the shared image pin')
})
