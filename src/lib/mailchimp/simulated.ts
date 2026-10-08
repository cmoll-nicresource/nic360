import type { Payload } from 'payload'

import type {
  MailchimpCampaign,
  MailchimpClient,
  MailchimpMemberUpdate,
  MailchimpSendResult,
  MailchimpUnsubscribeEvent,
} from './types'

/**
 * There is no Mailchimp test audience yet. This implementation writes every
 * call to the mailchimp-outbox collection instead of calling the real API,
 * so campaigns (with their full rendered HTML) can be reviewed in the admin.
 */
export function createSimulatedMailchimpClient(payload: Payload): MailchimpClient {
  return {
    async upsertMember(update: MailchimpMemberUpdate) {
      await payload.create({
        collection: 'mailchimp-outbox',
        data: {
          type: 'upsertMember',
          payload: update,
          segment: update.email,
        },
        overrideAccess: true,
      })
    },

    async createCampaign(campaign: MailchimpCampaign): Promise<MailchimpSendResult> {
      const campaignId = `sim_${crypto.randomUUID()}`
      await payload.create({
        collection: 'mailchimp-outbox',
        data: {
          type: 'createCampaign',
          payload: { campaignId, subject: campaign.subject, previewText: campaign.previewText },
          segment: campaign.segmentLabel,
          html: campaign.html,
        },
        overrideAccess: true,
      })
      return { campaignId }
    },

    async sendCampaign(campaignId: string) {
      await payload.create({
        collection: 'mailchimp-outbox',
        data: {
          type: 'sendCampaign',
          payload: { campaignId },
        },
        overrideAccess: true,
      })
    },

    async sendTest(campaign: MailchimpCampaign, testEmail: string) {
      await payload.create({
        collection: 'mailchimp-outbox',
        data: {
          type: 'sendTest',
          payload: { subject: campaign.subject, previewText: campaign.previewText, testEmail },
          segment: `test: ${testEmail}`,
          html: campaign.html,
        },
        overrideAccess: true,
      })
    },

    parseUnsubscribeWebhook(body: unknown): MailchimpUnsubscribeEvent | null {
      return parseMailchimpWebhookBody(body)
    },
  }
}

const REASON_MAP: Record<string, MailchimpUnsubscribeEvent['reason']> = {
  unsubscribe: 'unsubscribed',
  cleaned: 'cleaned',
}

/** Shared by both the simulated and live clients: Mailchimp's webhook shape is the same either way. */
export function parseMailchimpWebhookBody(body: unknown): MailchimpUnsubscribeEvent | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const type = b.type
  const data = b.data as Record<string, unknown> | undefined
  if (typeof type !== 'string' || !data) return null

  const email = data.email
  if (typeof email !== 'string') return null

  if (type === 'unsubscribe') {
    const reasonRaw = typeof data.reason === 'string' ? data.reason : ''
    const isSpam = reasonRaw.toLowerCase().includes('spam')
    return {
      email,
      reason: isSpam ? 'spam complaint' : 'unsubscribed',
      occurredAt: typeof b.fired_at === 'string' ? b.fired_at : new Date().toISOString(),
    }
  }
  if (type === 'cleaned') {
    return {
      email,
      reason: REASON_MAP.cleaned,
      occurredAt: typeof b.fired_at === 'string' ? b.fired_at : new Date().toISOString(),
    }
  }
  return null
}
