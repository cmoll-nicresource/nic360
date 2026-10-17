/** Only the committed test harness may enable local providers or disable job runners. */
export function assertTestIsolation(env: NodeJS.ProcessEnv = process.env) {
  const uri = new URL(env.DATABASE_URI ?? 'invalid:')
  if (
    env.E2E_TEST_MODE !== '1' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(uri.hostname) ||
    uri.pathname !== '/nic360_e2e_test' ||
    env.EMAIL_SAFE_MODE !== 'on'
  )
    throw new Error('Isolated nic360_e2e_test database and email safe mode are required.')
  for (const name of [
    'SES_ACCESS_KEY_ID',
    'SES_SECRET_ACCESS_KEY',
    'STRIPE_SECRET_KEY',
    'S3_BUCKET',
    'MAILCHIMP_API_KEY',
  ])
    if (env[name])
      throw new Error('External provider credentials are forbidden in browser tests: ' + name)
  return uri
}
