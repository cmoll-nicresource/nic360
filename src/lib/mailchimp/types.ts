export type MailchimpMemberUpdate = {
  email: string
  fullName: string
  /** interest-category-id -> on/off, one entry per Publication the audience can subscribe to */
  interests: Record<string, boolean>
}

export type MailchimpCampaign = {
  subject: string
  previewText?: string
  html: string
  /** The saved Mailchimp segment this campaign targets, e.g. the publication's mailchimp.segmentId */
  segmentId: string
  segmentLabel: string
}

export type MailchimpSendResult = {
  campaignId: string
}

export type MailchimpUnsubscribeEvent = {
  email: string
  reason: 'unsubscribed' | 'spam complaint' | 'cleaned'
  occurredAt: string
}

/**
 * Our site is the source of truth; Mailchimp only mirrors it, except for
 * unsubscribes. Two implementations, chosen by env MAILCHIMP_MODE:
 * simulated (writes to the mailchimp-outbox collection) and live (real API,
 * stubbed for now).
 */
export interface MailchimpClient {
  upsertMember(update: MailchimpMemberUpdate): Promise<void>
  createCampaign(campaign: MailchimpCampaign): Promise<MailchimpSendResult>
  sendCampaign(campaignId: string): Promise<void>
  sendTest(campaign: MailchimpCampaign, testEmail: string): Promise<void>
  /** Parses a Mailchimp unsubscribe/cleaned webhook payload into our shape. */
  parseUnsubscribeWebhook(body: unknown): MailchimpUnsubscribeEvent | null
}
