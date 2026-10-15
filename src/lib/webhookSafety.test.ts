import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import { POST as stripe } from '@/app/api/stripe/webhook/route'
import { POST as ses } from '@/app/api/ses/webhook/route'
import { POST as mailchimp } from '@/app/api/mailchimp/webhook/route'
import { snsSubscriptionUrl } from './snsSubscriptionUrl'
import type { Payload } from 'payload'
import { incrementPublicationIssueStat } from './incrementStat'
const { validate } = vi.hoisted(() => ({ validate: vi.fn() }))
vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: () => {
        throw new Error('Bad signature')
      },
    },
  }),
}))
vi.mock('@/lib/orderFulfillment', () => ({ markOrderPaid: vi.fn() }))
vi.mock('@/lib/emailFlags', () => ({ flagUserByEmail: vi.fn() }))
vi.mock('@/lib/incrementStat', () => ({ incrementPublicationIssueStat: vi.fn() }))
vi.mock('@/lib/mailchimp', () => ({ getMailchimpClient: vi.fn() }))
vi.mock('sns-validator', () => ({
  default: class {
    validate(body: unknown, callback: (error: Error | null) => void) {
      validate(body, callback)
    }
  },
}))
const topic = 'arn:aws:sns:us-east-1:123456789012:events'
const request = (body: unknown) =>
  new Request('https://beta.nicotine360.org/api/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  validate.mockImplementation((_body: unknown, callback: (error: Error | null) => void) =>
    callback(new Error('Bad signature')),
  )
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('EMAIL_PROVIDER', 'ses')
  vi.stubEnv('SES_MODE', 'simulated')
  vi.stubEnv('SES_SNS_TOPIC_ARN', topic)
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
it('refuses unsigned Stripe payment events when the secret is missing', async () => {
  expect(
    (
      await stripe(
        request({
          type: 'checkout.session.completed',
          data: { object: { metadata: { orderId: '1' } } },
        }),
      )
    ).status,
  ).toBe(503)
  expect(getPayload).not.toHaveBeenCalled()
})
it('requires SNS topic/signature even when publication sending is simulated', async () => {
  expect(
    (await ses(request({ Type: 'Notification', TopicArn: topic, Message: '{}' }))).status,
  ).toBe(400)
  expect((await ses(request({ Type: 'Notification', TopicArn: 'different' }))).status).toBe(403)
  vi.stubEnv('SES_SNS_TOPIC_ARN', '')
  expect((await ses(request({ Type: 'Notification' }))).status).toBe(503)
  expect(getPayload).not.toHaveBeenCalled()
})
it('does not let the unused Mailchimp endpoint change preferences', async () => {
  expect(
    (await mailchimp(request({ type: 'unsubscribe', email: 'someone@example.invalid' }))).status,
  ).toBe(410)
  expect(getPayload).not.toHaveBeenCalled()
})
it('accepts a verified notification from the configured SNS topic', async () => {
  validate.mockImplementation((_body: unknown, callback: (error: Error | null) => void) =>
    callback(null),
  )
  const payload = {} as Payload
  vi.mocked(getPayload).mockResolvedValue(payload)
  const response = await ses(
    request({
      Type: 'Notification',
      TopicArn: topic,
      Message: JSON.stringify({
        eventType: 'Delivery',
        mail: { destination: ['test@example.invalid'], tags: { issueId: ['42'] } },
      }),
    }),
  )
  expect(response.status).toBe(200)
  expect(incrementPublicationIssueStat).toHaveBeenCalledWith(payload, 42, 'stats_delivered', 1)
})
it('only permits confirmation URLs for the signed topic and token', () => {
  const body = {
    TopicArn: topic,
    Token: 'example-token',
    SubscribeURL:
      'https://sns.us-east-1.amazonaws.com/?' +
      new URLSearchParams({
        Action: 'ConfirmSubscription',
        TopicArn: topic,
        Token: 'example-token',
      }),
  }
  expect(snsSubscriptionUrl(body).hostname).toBe('sns.us-east-1.amazonaws.com')
  for (const url of [
    'http://localhost/internal',
    'https://sns.us-east-1.amazonaws.com.evil.invalid/',
    'https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=wrong',
  ])
    expect(() => snsSubscriptionUrl({ ...body, SubscribeURL: url })).toThrow()
})
