import Stripe from 'stripe'

let client: Stripe | null = null

/** Lazily constructed so the app can boot without a Stripe key in dev/CI. */
export function getStripeClient(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set.')
    client = new Stripe(key)
  }
  return client
}
