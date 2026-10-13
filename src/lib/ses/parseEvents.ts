import type { SesEvent, SesEventType } from './types'

type SesMail = {
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

  const mail = (b.mail ?? {}) as SesMail
  const occurredAt = mail.timestamp ?? new Date().toISOString()
  const issueTag = mail.tags?.issueId?.[0]
  const issueId = issueTag ? Number(issueTag) : undefined

  const emails = recipientsFor(type, b, mail)
  if (emails.length === 0) return null

  const bounceType =
    type === 'Bounce' ? (b.bounce as { bounceType?: string } | undefined)?.bounceType : undefined

  return { type, emails, issueId, occurredAt, bounceType }
}

function recipientsFor(type: SesEventType, b: Record<string, unknown>, mail: SesMail): string[] {
  if (type === 'Bounce') {
    const bounce = b.bounce as { bouncedRecipients?: { emailAddress?: string }[] } | undefined
    return (bounce?.bouncedRecipients ?? []).map((r) => r.emailAddress).filter((e): e is string => !!e)
  }
  if (type === 'Complaint') {
    const complaint = b.complaint as { complainedRecipients?: { emailAddress?: string }[] } | undefined
    return (complaint?.complainedRecipients ?? []).map((r) => r.emailAddress).filter((e): e is string => !!e)
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
