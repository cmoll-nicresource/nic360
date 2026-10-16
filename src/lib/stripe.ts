import Stripe from 'stripe'

let client: Stripe | null = null
let clientKey = ''

/** Lazily constructed so the app can boot without a Stripe key in dev/CI. */
export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.')
  const live = process.env.STRIPE_MODE === 'live'
  if (!key.startsWith(live ? 'sk_live_' : 'sk_test_'))
    throw new Error(
      `Stripe requires a ${live ? 'live' : 'test'} secret key for the configured mode.`,
    )
  if (!client || key !== clientKey) {
    client = new Stripe(key, { maxNetworkRetries: 1, timeout: 20_000 })
    clientKey = key
  }
  return client
}
