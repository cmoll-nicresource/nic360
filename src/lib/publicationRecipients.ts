import type { Payload } from 'payload'

import { getSubscriptionPlan, planSatisfies } from '@/access/subscriptionPlan'
import { getSuppressedEmails } from '@/lib/suppressionList'
import type { SesRecipient } from '@/lib/ses'

/**
 * Computes who should receive a publication *right now*, straight from our
 * own data — no persisted, synced audience state to keep correct. Users
 * who opted in (`emailPublications`), are still plan-eligible, and aren't
 * suppressed (bounced/complained/unsubscribed).
 */
export async function getPublicationRecipients(
  payload: Payload,
  publicationId: number,
): Promise<SesRecipient[]> {
  const suppressed = await getSuppressedEmails(payload)

  const recipients: SesRecipient[] = []
  const seen = new Set<string>()
  let page = 1
  for (;;) {
    const { docs: users, hasNextPage } = await payload.find({
      collection: 'users',
      where: {
        and: [
          { emailPublications: { in: [publicationId] } },
          { status: { equals: 'active' } },
          { _verified: { equals: true } },
        ],
      },
      depth: 1,
      limit: 500,
      page,
      overrideAccess: true,
    })

    for (const user of users) {
      const email = user.email.trim().toLowerCase()
      if (suppressed.has(email) || seen.has(email)) continue
      const plan = await getSubscriptionPlan(user, payload)
      if (!planSatisfies(plan, 'base')) continue
      seen.add(email)
      recipients.push({ email, userId: user.id })
    }
    if (!hasNextPage) break
    page++
  }
  return recipients
}
