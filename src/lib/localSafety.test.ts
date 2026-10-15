import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { allowLocalWebhookSimulation, assertSafeDemoSeed, secretMatches } from './localSafety'
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('SITE_URL', 'http://localhost:3000')
  vi.stubEnv('DATABASE_URI', 'postgresql://localhost/nic360_demo')
  vi.stubEnv('ALLOW_UNSAFE_LOCAL_WEBHOOKS', 'true')
})
afterEach(() => vi.unstubAllEnvs())
it('requires explicit local opt-in and refuses every deployed or remote configuration', () => {
  const request = new Request('http://localhost:3000/api/test')
  expect(allowLocalWebhookSimulation(request)).toBe(true)
  expect(allowLocalWebhookSimulation(new Request('https://beta.nicotine360.org/api/test'))).toBe(
    false,
  )
  for (const [key, value] of [
    ['NODE_ENV', 'production'],
    ['DATABASE_URI', 'postgresql://remote.invalid/db'],
    ['SITE_URL', 'https://beta.nicotine360.org'],
    ['ALLOW_UNSAFE_LOCAL_WEBHOOKS', 'false'],
  ]) {
    vi.stubEnv(key, value)
    expect(allowLocalWebhookSimulation(request)).toBe(false)
    vi.unstubAllEnvs()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('SITE_URL', 'http://localhost:3000')
    vi.stubEnv('DATABASE_URI', 'postgresql://localhost/nic360_demo')
    vi.stubEnv('ALLOW_UNSAFE_LOCAL_WEBHOOKS', 'true')
  }
})
it('checks webhook secrets without accepting missing or different values', () => {
  expect(secretMatches('abc', 'abc')).toBe(true)
  expect(secretMatches('abc', 'xyz')).toBe(false)
  expect(secretMatches(null, undefined)).toBe(false)
})
it('requires a dedicated local demo/test DB and both explicit reset switches', () => {
  const env = {
    DATABASE_URI: 'postgresql://localhost/nic360_demo',
    ALLOW_DESTRUCTIVE_LOCAL_SEED: 'true',
  }
  expect(() => assertSafeDemoSeed(env, ['--reset-local-demo'])).not.toThrow()
  for (const patch of [
    { DATABASE_URI: 'postgresql://localhost/nic360' },
    { DATABASE_URI: 'postgresql://remote.invalid/nic360_demo' },
    { NODE_ENV: 'production' },
    { ALLOW_DESTRUCTIVE_LOCAL_SEED: 'false' },
    { S3_BUCKET: 'real' },
    { SES_ACCESS_KEY_ID: 'configured' },
    { STRIPE_SECRET_KEY: 'configured' },
  ])
    expect(() => assertSafeDemoSeed({ ...env, ...patch }, ['--reset-local-demo'])).toThrow()
  expect(() => assertSafeDemoSeed(env, [])).toThrow()
})
