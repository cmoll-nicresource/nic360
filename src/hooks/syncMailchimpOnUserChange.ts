import type { CollectionAfterChangeHook } from 'payload'

import type { User } from '@/payload-types'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { getMailchimpClient } from '@/lib/mailchimp'

/**
 * Keeps Mailchimp in sync with our site whenever a reader's choices, name,
 * email or eligibility changes. Our site is the source of truth; Mailchimp
 * only mirrors it (unsubscribes are the one exception — see the webhook
 * route). Ineligible readers (provider expired, plan dropped to None, etc.)
 * have their preferences cleared defensively, in case something wrote to
 * emailPublications without going through the account page's eligibility
 * check first.
 */
export const syncMailchimpOnUserChange: CollectionAfterChangeHook<User> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return doc

  const relevantFieldsChanged =
    doc.email !== previousDoc?.email ||
    doc.firstName !== previousDoc?.firstName ||
    doc.lastName !== previousDoc?.lastName ||
    JSON.stringify(doc.emailPublications ?? []) !== JSON.stringify(previousDoc?.emailPublications ?? []) ||
    JSON.stringify(doc.accessProvider ?? null) !== JSON.stringify(previousDoc?.accessProvider ?? null)

  if (!relevantFieldsChanged) return doc

  const plan = await getReaderPlan(doc, req.payload)
  const eligible = planSatisfies(plan, 'base')

  if (!eligible && (doc.emailPublications?.length ?? 0) > 0) {
    await req.payload.update({
      collection: 'users',
      id: doc.id,
      data: { emailPublications: [] },
      overrideAccess: true,
      req,
    })
    return doc
  }

  const { docs: allPublications } = await req.payload.find({
    collection: 'publications',
    limit: 200,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const subscribedIds = new Set((doc.emailPublications ?? []).map((p) => (typeof p === 'object' ? p.id : p)))

  const interests: Record<string, boolean> = {}
  for (const pub of allPublications) {
    if (pub.mailchimp?.interestId) {
      interests[pub.mailchimp.interestId] = eligible && subscribedIds.has(pub.id)
    }
  }

  const client = getMailchimpClient(req.payload)
  await client.upsertMember({
    email: doc.email,
    fullName: `${doc.firstName} ${doc.lastName}`,
    interests,
  })

  return doc
}
