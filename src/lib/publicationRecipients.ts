import type { Payload } from 'payload'

import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { getSuppressedEmails } from '@/lib/suppressionList'
import type { SesRecipient } from '@/lib/ses'

/**
 * Computes who should receive a publication *right now*, straight from our
 * own data — no persisted, synced audience state to keep correct. Readers
 * who opted in (`emailPublications`), are still plan-eligible, and aren't
 * suppressed (bounced/complained/unsubscribed).
 */
export async function getPublicationRecipients(payload: Payload, publicationId: number): Promise<SesRecipient[]> {
  const suppressed = await getSuppressedEmails(payload)

  const { docs: users } = await payload.find({
    collection: 'users',
    where: { emailPublications: { in: [publicationId] } },
    depth: 1,
    limit: 5000,
    overrideAccess: true,
  })

  const recipients: SesRecipient[] = []
  for (const user of users) {
    if (suppressed.has(user.email.toLowerCase())) continue
    const plan = await getReaderPlan(user, payload)
    if (!planSatisfies(plan, 'base')) continue
    recipients.push({ email: user.email, userId: user.id })
  }
  return recipients
}
