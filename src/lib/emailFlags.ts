import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { transactionDb } from './payloadTransaction'

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
  req?: PayloadRequest,
): Promise<number | null> {
  if (req?.transactionID) {
    const transactionID = await req.transactionID
    await transactionDb(payload, transactionID).execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`email-flag:${email.toLowerCase()}`}))`,
    )
  }
  const { docs: users } = await payload.find({
    collection: 'users',
    where: { email: { equals: email.toLowerCase() } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const user = users[0]
  if (!user) return null

  const { totalDocs: alreadyOpen } = await payload.find({
    collection: 'email-flags',
    where: { and: [{ user: { equals: user.id } }, { status: { in: ['open', 'following up'] } }] },
    limit: 0,
    overrideAccess: true,
    req,
  })
  if (alreadyOpen > 0) return null

  const publicationsBefore = user.emailPublications ?? []

  const flag = await payload.create({
    collection: 'email-flags',
    data: { user: user.id, reason, occurredAt, publicationsBefore, status: 'open' },
    overrideAccess: true,
    req,
  })
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { emailPublications: [] },
    overrideAccess: true,
    req,
  })

  return flag.id
}
