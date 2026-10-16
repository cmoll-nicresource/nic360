export type SesRecipient = { email: string; userId?: number }

export type SesSendInput = {
  issueId: number
  subject: string
  html: string
  recipients: SesRecipient[]
  test?: boolean
  deliveryId?: number
  onAccepted?: (messageId: string) => Promise<void>
}

export type SesSendResult = { messageCount: number; messageIds?: string[] }

export type SesEventType = 'Send' | 'Delivery' | 'Open' | 'Click' | 'Bounce' | 'Complaint'

/** Our normalized shape for one SES Configuration Set event, after unwrapping the SNS envelope. One event can affect several recipients (e.g. a bounce). */
export type SesEvent = {
  type: SesEventType
  emails: string[]
  issueId?: number
  occurredAt: string
  bounceType?: string
  messageId?: string
  test?: boolean
  deliveryId?: number
}

/**
 * Sending and event-tracking for publication issues, as an alternative to
 * Mailchimp campaigns — see docs/entity-map.md's Email delivery section.
 * Two implementations chosen by env SES_MODE: simulated (writes to the
 * ses-outbox collection) and live (private, personalized SES messages).
 */
export interface SesClient {
  sendBulk(input: SesSendInput): Promise<SesSendResult>
}
