import Stripe from 'stripe'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/stripe/webhook/route'
import { handleStripeSession } from './stripeFulfillment'
import { getPayload } from 'payload'

vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('./stripeFulfillment', () => ({ handleStripeSession: vi.fn() }))
vi.mock('./stripe', () => ({ getStripeClient: () => new Stripe('sk_test_offline_fixture') }))
const secret = 'whsec_offline_fixture'
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
  vi.stubEnv('STRIPE_MODE', 'test')
  vi.mocked(getPayload).mockResolvedValue({} as Awaited<ReturnType<typeof getPayload>>)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
function request(type = 'checkout.session.completed', change = {}, badSignature = false) {
  const body = JSON.stringify({
    id: 'evt_fixture',
    type,
    livemode: false,
    data: { object: { id: 'cs_test_fixture' } },
    ...change,
  })
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: badSignature ? 'wrong-secret' : secret,
  })
  return new Request('https://beta.nicotine360.org/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': signature },
  })
}
it('checks the real Stripe signature before initializing Payload', async () => {
  expect((await POST(request('checkout.session.completed', {}, true))).status).toBe(400)
  expect(getPayload).not.toHaveBeenCalled()
  expect(handleStripeSession).not.toHaveBeenCalled()
})
it('passes signed session IDs to authoritative fulfillment and acknowledges redelivery', async () => {
  expect((await POST(request())).status).toBe(200)
  expect((await POST(request())).status).toBe(200)
  expect(handleStripeSession).toHaveBeenCalledWith({}, 'cs_test_fixture')
})
it('returns retryable failure and rejects live events in test mode', async () => {
  vi.mocked(handleStripeSession).mockRejectedValue(new Error('database failed'))
  expect((await POST(request())).status).toBe(500)
  expect((await POST(request('checkout.session.completed', { livemode: true }))).status).toBe(400)
})
it('handles signed expiration and ignores unrelated event types', async () => {
  expect((await POST(request('checkout.session.expired'))).status).toBe(200)
  vi.mocked(handleStripeSession).mockClear()
  expect((await POST(request('payment_intent.created'))).status).toBe(200)
  expect(handleStripeSession).not.toHaveBeenCalled()
})
