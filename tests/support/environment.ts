import { assertTestIsolation } from '../../src/lib/testIsolation'
export function testEnvironment() {
  const env = {
    ...process.env,
    DATABASE_URI:
      process.env.TEST_DATABASE_URI ??
      'postgresql://postgres:local-e2e-only@127.0.0.1:5444/nic360_e2e_test',
    PAYLOAD_SECRET: 'test-only-browser-secret-not-a-live-secret',
    E2E_TEST_MODE: '1',
    EMAIL_SAFE_MODE: 'on',
    EMAIL_SAFE_MODE_REDIRECT_TO: 'sink@example.invalid',
    E2E_SMTP_URL: 'smtp://127.0.0.1:2525',
    SITE_URL: 'http://127.0.0.1:3100',
    NEXT_PUBLIC_SERVER_URL: 'http://127.0.0.1:3100',
    SES_ACCESS_KEY_ID: '',
    SES_SECRET_ACCESS_KEY: '',
    STRIPE_SECRET_KEY: '',
    S3_BUCKET: '',
    MAILCHIMP_API_KEY: '',
    STATENET_ITRAC_URL: 'https://itrac.example.invalid/portal?key=synthetic-test-only',
    EMAIL_PROVIDER: 'simulate',
    STRIPE_MODE: 'test',
    NEXT_TELEMETRY_DISABLED: '1',
  }
  if (process.env.E2E_SEEDING === '1') env.E2E_SMTP_URL = ''
  assertTestIsolation(env)
  return env
}
export function applyTestEnvironment() {
  Object.assign(process.env, testEnvironment())
  assertTestIsolation()
}
