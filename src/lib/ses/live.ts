import { SendRawEmailCommand, SESClient } from '@aws-sdk/client-ses'
import nodemailer from 'nodemailer'
import { emailSafeModeRedirectAddress, isEmailSafeModeEnabled } from '@/lib/emailSafeMode'
import { unsubscribeUrl } from './unsubscribe'
import { newsletterMessageHtml } from './messageHtml'
import { newsletterPlainText } from './plainText'
import type { SesClient, SesSendInput, SesSendResult } from './types'

export function newsletterLiveConfig() {
  const e = process.env
  if (
    !e.SES_ACCESS_KEY_ID ||
    !e.SES_SECRET_ACCESS_KEY ||
    !e.SES_FROM_ADDRESS ||
    !e.SES_CONFIGURATION_SET ||
    !e.SES_SNS_TOPIC_ARN
  )
    throw new Error(
      'Live newsletters require SES credentials, SES_FROM_ADDRESS, SES_CONFIGURATION_SET and SES_SNS_TOPIC_ARN.',
    )
  if (!e.SITE_URL || new URL(e.SITE_URL).protocol !== 'https:')
    throw new Error('Live newsletters require an HTTPS SITE_URL.')
  if (!e.NEWSLETTER_UNSUBSCRIBE_SECRET && !e.PAYLOAD_SECRET)
    throw new Error('Unsubscribe signing secret is required.')
  return {
    region: e.SES_REGION || 'us-east-1',
    from: e.SES_FROM_ADDRESS,
    configurationSet: e.SES_CONFIGURATION_SET,
    credentials: { accessKeyId: e.SES_ACCESS_KEY_ID, secretAccessKey: e.SES_SECRET_ACCESS_KEY },
  }
}

/** One envelope recipient per call; no automatic retries after an ambiguous network failure. */
export function createLiveSesClient(): SesClient {
  return {
    async sendBulk(input: SesSendInput): Promise<SesSendResult> {
      const config = newsletterLiveConfig()
      if (!input.test && isEmailSafeModeEnabled())
        throw new Error(
          'Live audience delivery is disabled while EMAIL_SAFE_MODE is on. Use Send test.',
        )
      const client = new SESClient({
        region: config.region,
        credentials: config.credentials,
        maxAttempts: 1,
      })
      const composer = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'windows',
      })
      let messageCount = 0
      const messageIds: string[] = []
      try {
        for (const recipient of input.recipients) {
          if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient.email))
            throw new Error('Invalid recipient address')
          if (!input.test && (!recipient.userId || !Number.isSafeInteger(recipient.userId)))
            throw new Error('Audience recipients require a user account for unsubscribe links')
          const destination = isEmailSafeModeEnabled()
            ? emailSafeModeRedirectAddress()
            : recipient.email
          const url = unsubscribeUrl(recipient.userId || 0, recipient.email, !!input.test)
          const html = newsletterMessageHtml(
            input.html,
            url,
            `${process.env.SITE_URL}/account`,
            !!input.test,
          )
          const mail = await composer.sendMail({
            from: config.from,
            to: destination,
            subject: input.subject,
            html,
            text: newsletterPlainText(html),
            headers: {
              'List-Unsubscribe': `<${url}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
            disableFileAccess: true,
            disableUrlAccess: true,
          })
          if (!Buffer.isBuffer(mail.message)) throw new Error('MIME message was not buffered')
          const response = await client.send(
            new SendRawEmailCommand({
              Source: config.from,
              Destinations: [destination],
              RawMessage: { Data: mail.message },
              ConfigurationSetName: config.configurationSet,
              Tags: [
                { Name: 'issueId', Value: String(input.issueId) },
                { Name: 'newsletterTest', Value: input.test ? 'true' : 'false' },
                ...(input.deliveryId
                  ? [{ Name: 'deliveryId', Value: String(input.deliveryId) }]
                  : []),
              ],
            }),
            { abortSignal: AbortSignal.timeout(20000) },
          )
          if (!response.MessageId) throw new Error('SES response did not contain a message ID')
          messageCount++
          messageIds.push(response.MessageId)
          if (input.onAccepted) await input.onAccepted(response.MessageId)
        }
      } finally {
        client.destroy()
        composer.close()
      }
      return { messageCount, messageIds }
    },
  }
}
