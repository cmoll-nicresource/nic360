import { afterEach, expect, it, vi } from 'vitest'
import { getStripeClient } from './stripe'

afterEach(() => vi.unstubAllEnvs())
it('defaults to Stripe test mode and refuses a live key', () => {
  vi.stubEnv('STRIPE_MODE', '')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_offline_fixture')
  expect(() => getStripeClient()).toThrow('test secret key')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_offline_fixture')
  expect(getStripeClient()).toBeTruthy()
})
it('requires an explicit live setting and rejects a test key in live mode', () => {
  vi.stubEnv('STRIPE_MODE', 'live')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_offline_fixture')
  expect(() => getStripeClient()).toThrow('live secret key')
})
