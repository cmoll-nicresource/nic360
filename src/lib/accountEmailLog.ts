/**
 * Pure rules for the account email log: which messages are recorded, how long
 * their links last, and when a recipient looks like they are not receiving mail.
 */
export const ACCOUNT_EMAIL_KINDS = [
  { label: 'Password reset', value: 'reset' },
  { label: 'Event invitation', value: 'invitation' },
  { label: 'Account ready (staff-created)', value: 'account-ready' },
  { label: 'Signup code', value: 'signup-code' },
  { label: 'Email confirmation', value: 'verification' },
  { label: 'Staff password reset', value: 'staff-reset' },
  { label: 'Link issued by staff', value: 'staff-link' },
] as const

export type AccountEmailKind = (typeof ACCOUNT_EMAIL_KINDS)[number]['value']

const HOUR = 60 * 60 * 1000

/** Which account email a subject line belongs to; null for anything else (operations alerts, etc.). */
export function classifyAccountEmail(subject: string | undefined | null): AccountEmailKind | null {
  const text = (subject ?? '').trim()
  if (/^Reset your Nicotine360 staff password$/i.test(text)) return 'staff-reset'
  if (/^Reset your Nicotine360 password$/i.test(text)) return 'reset'
  if (/^Your Nicotine360 event invitation$/i.test(text)) return 'invitation'
  if (/^Your Nicotine360 account is ready$/i.test(text)) return 'account-ready'
  if (/^Your Nicotine360 verification code: \d{6}$/i.test(text)) return 'signup-code'
  if (/^Confirm your Nicotine360 email address$/i.test(text)) return 'verification'
  return null
}

/** How long the link or code in a message works. Null: no fixed limit, or nothing sensitive to expire. */
export function linkLifetimeMs(kind: AccountEmailKind): number | null {
  switch (kind) {
    case 'reset':
    case 'invitation':
    case 'account-ready':
    case 'staff-link':
      return HOUR
    case 'signup-code':
      return 15 * 60 * 1000
    default:
      return null
  }
}

/** Staff password reset links give access to the admin, so their content is never stored. */
export const storesMessageBody = (kind: AccountEmailKind) => kind !== 'staff-reset'

/** Mail that needs the recipient to act. Two of these to one address in a day means it probably did not arrive. */
export const ACTION_KINDS: AccountEmailKind[] = [
  'reset',
  'invitation',
  'account-ready',
  'signup-code',
  'verification',
]

export const STUCK_WINDOW_MS = 24 * HOUR
export const STUCK_THRESHOLD = 2

export const isStuck = (messagesInWindow: number) => messagesInWindow >= STUCK_THRESHOLD

/** True while the link in a logged message can still be used, so its body may be shown. */
export function linkIsLive(
  kind: AccountEmailKind,
  sentAt: string | Date,
  now: number = Date.now(),
): boolean {
  const lifetime = linkLifetimeMs(kind)
  return lifetime !== null && new Date(sentAt).getTime() + lifetime > now
}

export type StuckRecipient = { email: string; messages: number; lastSentAt: string }

/**
 * Recipients to chase: two or more action messages in the window, and no sign-in
 * since the latest one. `lastLoginByEmail` maps lowercase address to ISO time.
 */
export function stuckRecipients(
  rows: { recipient: string; kind: AccountEmailKind; createdAt: string }[],
  lastLoginByEmail: Record<string, string | null | undefined>,
  now: number = Date.now(),
): StuckRecipient[] {
  const groups = new Map<string, { messages: number; last: string }>()
  for (const row of rows) {
    if (!ACTION_KINDS.includes(row.kind)) continue
    if (now - new Date(row.createdAt).getTime() > STUCK_WINDOW_MS) continue
    const key = row.recipient.toLowerCase()
    const group = groups.get(key) ?? { messages: 0, last: row.createdAt }
    group.messages++
    if (row.createdAt > group.last) group.last = row.createdAt
    groups.set(key, group)
  }
  return [...groups.entries()]
    .filter(([email, group]) => {
      if (!isStuck(group.messages)) return false
      const login = lastLoginByEmail[email]
      return !login || login < group.last
    })
    .map(([email, group]) => ({ email, messages: group.messages, lastSentAt: group.last }))
    .sort((a, b) => (a.lastSentAt < b.lastSentAt ? 1 : -1))
}
