import type { Payload } from 'payload'

/** Emails with an open EmailFlag (bounced/complained/unsubscribed) — never send to these. */
export async function getSuppressedEmails(payload: Payload): Promise<Set<string>> {
  const { docs } = await payload.find({
    collection: 'email-flags',
    where: { status: { equals: 'open' } },
    depth: 1,
    limit: 2000,
    overrideAccess: true,
  })

  const emails = new Set<string>()
  for (const flag of docs) {
    const user = typeof flag.user === 'object' ? flag.user : null
    if (user?.email) emails.add(user.email.toLowerCase())
  }
  return emails
}
