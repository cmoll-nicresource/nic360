import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createLiveSesClient } from './live'
const { send, options } = vi.hoisted(() => ({ send: vi.fn(), options: vi.fn() }))
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: class {
    constructor(config: unknown) {
      options(config)
    }
    send = send
    destroy() {}
  },
  SendRawEmailCommand: class {
    constructor(readonly input: unknown) {}
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  for (const [key, value] of Object.entries({
    SES_ACCESS_KEY_ID: 'fixture',
    SES_SECRET_ACCESS_KEY: 'fixture',
    SES_CONFIGURATION_SET: 'newsletter-fixture',
    SES_FROM_ADDRESS: 'pubs@example.invalid',
    SES_SNS_TOPIC_ARN: 'arn:aws:sns:us-east-1:123456789012:newsletter',
    SITE_URL: 'https://beta.example.invalid',
    PAYLOAD_SECRET: 'fixture-only-test-signing-secret',
    EMAIL_SAFE_MODE: 'on',
    EMAIL_SAFE_MODE_REDIRECT_TO: 'safe@example.invalid',
  }))
    vi.stubEnv(key, value)
  send.mockResolvedValue({ MessageId: 'accepted-id' })
})
afterEach(() => vi.unstubAllEnvs())
const input = {
  issueId: 3,
  subject: 'Fixture',
  html: '<html><body>Publication body</body></html>',
  recipients: [{ email: 'user@example.invalid', userId: 8 }],
}
it('blocks live audience delivery in safe mode before contacting SES', async () => {
  await expect(createLiveSesClient().sendBulk(input)).rejects.toThrow('EMAIL_SAFE_MODE')
  expect(send).not.toHaveBeenCalled()
})
it('redirects a test to the safe mailbox, personalizes MIME, and tags it to exclude audience statistics', async () => {
  expect(await createLiveSesClient().sendBulk({ ...input, test: true })).toEqual({
    messageCount: 1,
    messageIds: ['accepted-id'],
  })
  const command = send.mock.calls[0][0].input
  expect(command.Destinations).toEqual(['safe@example.invalid'])
  expect(command.ConfigurationSetName).toBe('newsletter-fixture')
  expect(command.Tags).toContainEqual({ Name: 'newsletterTest', Value: 'true' })
  const mime = command.RawMessage.Data.toString('utf8').replace(/\r\n[ \t]+/g, ' ')
  expect(mime).toContain('To: safe@example.invalid')
  expect(mime).toContain(
    'List-Unsubscribe: <https://beta.example.invalid/api/newsletters/unsubscribe?token=',
  )
  expect(mime).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click')
  expect(mime).toContain('multipart/alternative')
  expect(options).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 1 }))
})
it('sends privately to one envelope recipient per call and journals every acceptance', async () => {
  vi.stubEnv('EMAIL_SAFE_MODE', 'off')
  const accepted = vi.fn()
  await createLiveSesClient().sendBulk({
    ...input,
    recipients: [...input.recipients, { email: 'second@example.invalid', userId: 9 }],
    deliveryId: 7,
    onAccepted: accepted,
  })
  expect(send.mock.calls.map((c) => c[0].input.Destinations)).toEqual([
    ['user@example.invalid'],
    ['second@example.invalid'],
  ])
  expect(accepted).toHaveBeenCalledTimes(2)
  expect(send.mock.calls[0][0].input.Tags).toContainEqual({ Name: 'deliveryId', Value: '7' })
})
it('does not retry a timeout or fabricate success', async () => {
  send.mockRejectedValue(new Error('Connection interrupted'))
  await expect(createLiveSesClient().sendBulk({ ...input, test: true })).rejects.toThrow(
    'Connection interrupted',
  )
  expect(send).toHaveBeenCalledTimes(1)
})
it('requires the feedback infrastructure and refuses malformed recipients', async () => {
  vi.stubEnv('SES_CONFIGURATION_SET', '')
  await expect(createLiveSesClient().sendBulk({ ...input, test: true })).rejects.toThrow(
    'SES_CONFIGURATION_SET',
  )
  expect(send).not.toHaveBeenCalled()
})
