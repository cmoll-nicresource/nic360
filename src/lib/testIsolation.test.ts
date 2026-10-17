import { describe, expect, it } from 'vitest'
import { assertTestIsolation } from './testIsolation'

const isolated: NodeJS.ProcessEnv = { NODE_ENV: 'test', E2E_TEST_MODE: '1', DATABASE_URI: 'postgresql://postgres:fake@127.0.0.1:5432/nic360_e2e_test', EMAIL_SAFE_MODE: 'on' }
describe('test isolation gate', () => {
  it('permits only the explicit local synthetic database with safe email', () => {
    expect(() => assertTestIsolation(isolated)).not.toThrow()
    for (const change of [
      { E2E_TEST_MODE: '0' }, { EMAIL_SAFE_MODE: 'off' },
      { DATABASE_URI: 'postgresql://postgres:fake@127.0.0.1:5432/railway' },
      { DATABASE_URI: 'postgresql://postgres:fake@database.example.com/nic360_e2e_test' },
      { SES_ACCESS_KEY_ID: 'real-key' }, { STRIPE_SECRET_KEY: 'sk_test_external' },
      { S3_BUCKET: 'real-uploads' }, { MAILCHIMP_API_KEY: 'external-provider' },
    ]) expect(() => assertTestIsolation({ ...isolated, ...change })).toThrow()
  })
})
