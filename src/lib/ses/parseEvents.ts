import type { SesEvent, SesEventType } from './types'

type SesMail = {
  messageId?: string
  timestamp?: string
  destination?: string[]
  tags?: Record<string, string[]>
}

/**
 * Parses one already-unwrapped SES Configuration Set event (the JSON that
 * was inside the SNS envelope's `Message` field) into our normalized shape.
 * We send one message per recipient (see sendBulk), so `mail.destination`
 * is expected to hold exactly one address in practice, but this doesn't
 * assume that — a Bounce/Complaint can legitimately list several.
 */
export function parseSesEvent(body: unknown): SesEvent | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const type = b.eventType
  if (typeof type !== 'string' || !isSesEventType(type)) return null

  const mail = (b.mail && typeof b.mail === 'object' ? b.mail : {}) as SesMail
  const detail = b[type.toLowerCase()] as { timestamp?: string } | undefined
  const timestamp = detail?.timestamp || mail.timestamp
  const occurredAt =
    typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp))
      ? timestamp
      : new Date().toISOString()
  const issueTag = mail.tags?.issueId?.[0]
  const issueId = issueTag ? Number(issueTag) : undefined
  const deliveryId = Number(mail.tags?.deliveryId?.[0])

  const rawEmails = recipientsFor(type, b, mail)
  const emails = Array.isArray(rawEmails)
    ? [
        ...new Set(
          rawEmails
            .filter(
              (value): value is string =>
                typeof value === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value),
            )
            .map((e) => e.toLowerCase()),
        ),
      ]
    : []
  if (emails.length === 0) return null

  const bounceType =
    type === 'Bounce' ? (b.bounce as { bounceType?: string } | undefined)?.bounceType : undefined

  return {
    type,
    emails,
    issueId: Number.isSafeInteger(issueId) && issueId! > 0 ? issueId : undefined,
    occurredAt,
    bounceType,
    ...(mail.messageId ? { messageId: mail.messageId } : {}),
    ...(mail.tags?.newsletterTest?.[0] === 'true' ? { test: true } : {}),
    ...(Number.isSafeInteger(deliveryId) && deliveryId > 0 ? { deliveryId } : {}),
  }
}

function recipientsFor(type: SesEventType, b: Record<string, unknown>, mail: SesMail): string[] {
  if (type === 'Bounce') {
    const bounce = b.bounce as { bouncedRecipients?: { emailAddress?: string }[] } | undefined
    return (Array.isArray(bounce?.bouncedRecipients) ? bounce.bouncedRecipients : [])
      .map((r) => r?.emailAddress)
      .filter((e): e is string => !!e)
  }
  if (type === 'Complaint') {
    const complaint = b.complaint as
      { complainedRecipients?: { emailAddress?: string }[] } | undefined
    return (Array.isArray(complaint?.complainedRecipients) ? complaint.complainedRecipients : [])
      .map((r) => r?.emailAddress)
      .filter((e): e is string => !!e)
  }
  if (type === 'Delivery') {
    const delivery = b.delivery as { recipients?: string[] } | undefined
    return delivery?.recipients ?? mail.destination ?? []
  }
  // Send, Open, Click: these apply to the message's destination.
  return mail.destination ?? []
}

const EVENT_TYPES: SesEventType[] = ['Send', 'Delivery', 'Open', 'Click', 'Bounce', 'Complaint']
function isSesEventType(value: string): value is SesEventType {
  return (EVENT_TYPES as string[]).includes(value)
}
