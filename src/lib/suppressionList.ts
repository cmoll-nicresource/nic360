import type { Payload } from 'payload'

/** Unresolved delivery flags suppress the retained address even after account deletion. */
export async function getSuppressedEmails(payload: Payload): Promise<Set<string>> {
  const emails = new Set<string>()
  let page = 1
  for (;;) {
    const { docs, hasNextPage } = await payload.find({
      collection: 'email-flags',
      where: { status: { in: ['open', 'following up'] } },
      depth: 1,
      limit: 500,
      page,
      overrideAccess: true,
    })
    for (const flag of docs) {
      const user = typeof flag.user === 'object' ? flag.user : null
      if (flag.recipientEmail) emails.add(flag.recipientEmail.trim().toLowerCase())
      if (user?.email) emails.add(user.email.toLowerCase())
    }
    if (!hasNextPage) break
    page++
  }
  return emails
}
