import { createHmac, timingSafeEqual } from 'node:crypto'

type PreferenceToken = { userId: number; email: string; test: boolean }
function secret() {
  const value = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || process.env.PAYLOAD_SECRET
  if (!value) throw new Error('Newsletter unsubscribe signing secret is missing')
  return value
}
export function unsubscribeToken(userId: number, email: string, test = false): string {
  const body = Buffer.from(
    JSON.stringify({ userId, email: email.trim().toLowerCase(), test }),
  ).toString('base64url')
  return `${body}.${createHmac('sha256', secret()).update(`newsletter-unsubscribe:${body}`).digest('base64url')}`
}
export function readUnsubscribeToken(token: string): PreferenceToken | null {
  if (token.length > 2000) return null
  const [body, signature, extra] = token.split('.')
  if (!body || !signature || extra) return null
  const expected = createHmac('sha256', secret())
    .update(`newsletter-unsubscribe:${body}`)
    .digest('base64url')
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null
  try {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString())
    return Number.isSafeInteger(value.userId) &&
      value.userId >= 0 &&
      typeof value.email === 'string' &&
      /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.email) &&
      typeof value.test === 'boolean'
      ? value
      : null
  } catch {
    return null
  }
}
export function unsubscribeUrl(userId: number, email: string, test = false): string {
  return `${process.env.SITE_URL || 'http://localhost:3000'}/api/newsletters/unsubscribe?token=${unsubscribeToken(userId, email, test)}`
}
