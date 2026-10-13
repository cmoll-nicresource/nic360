import type { Payload } from 'payload'

export type EmailFlagReason = 'unsubscribed' | 'spam complaint' | 'cleaned'

/**
 * Shared by the Mailchimp and SES webhooks: clears the user's publication
 * preferences and opens an EmailFlag for staff follow-up (the Re-add button
 * restores `publicationsBefore`). Skips creating a duplicate if that user
 * already has an open flag.
 */
export async function flagUserByEmail(
  payload: Payload,
  email: string,
  reason: EmailFlagReason,
  occurredAt: string,
): Promise<number | null> {
  const { docs: users } = await payload.find({
    collection: 'users',
    where: { email: { equals: email.toLowerCase() } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const user = users[0]
  if (!user) return null

  const { totalDocs: alreadyOpen } = await payload.find({
    collection: 'email-flags',
    where: { and: [{ user: { equals: user.id } }, { status: { equals: 'open' } }] },
    limit: 0,
    overrideAccess: true,
  })
  if (alreadyOpen > 0) return null

  const publicationsBefore = user.emailPublications ?? []

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { emailPublications: [] },
    overrideAccess: true,
  })

  const flag = await payload.create({
    collection: 'email-flags',
    data: { user: user.id, reason, occurredAt, publicationsBefore, status: 'open' },
    overrideAccess: true,
  })

  return flag.id
}
