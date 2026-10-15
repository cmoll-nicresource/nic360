import { createHash, timingSafeEqual } from 'node:crypto'

export function isLoopbackUrl(value: string | undefined): boolean {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value!).hostname)
  } catch {
    return false
  }
}

/** Unsigned provider fixtures are opt-in and restricted to an isolated local setup. */
export function allowLocalWebhookSimulation(request: Request): boolean {
  return (
    ['development', 'test'].includes(process.env.NODE_ENV || '') &&
    process.env.ALLOW_UNSAFE_LOCAL_WEBHOOKS === 'true' &&
    isLoopbackUrl(request.url) &&
    isLoopbackUrl(process.env.SITE_URL) &&
    isLoopbackUrl(process.env.DATABASE_URI)
  )
}

export function secretMatches(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false
  const hash = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(hash(actual), hash(expected))
}

export function assertSafeDemoSeed(env: Record<string, string | undefined>, args: string[]): void {
  const uri = env.DATABASE_URI
  if (
    env.NODE_ENV === 'production' ||
    !isLoopbackUrl(uri) ||
    !args.includes('--reset-local-demo') ||
    env.ALLOW_DESTRUCTIVE_LOCAL_SEED !== 'true'
  ) {
    throw new Error(
      'Seed reset refused. Use a loopback demo/test database, ALLOW_DESTRUCTIVE_LOCAL_SEED=true, and --reset-local-demo.',
    )
  }
  const database = decodeURIComponent(new URL(uri!).pathname.slice(1))
  if (!/^nic360_(?:[a-z0-9_]+_)?(?:demo|test)$/.test(database))
    throw new Error(
      'Seed reset requires a dedicated nic360_*_demo or nic360_*_test database; the working nic360 database is protected.',
    )
  if (
    env.S3_BUCKET ||
    env.SES_ACCESS_KEY_ID ||
    env.SES_SECRET_ACCESS_KEY ||
    env.STRIPE_SECRET_KEY ||
    env.MAILCHIMP_MODE === 'live' ||
    env.SES_MODE === 'live'
  ) {
    throw new Error(
      'Seed reset requires local file storage and simulated providers without live service credentials.',
    )
  }
}
