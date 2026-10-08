import type { CollectionAfterChangeHook } from 'payload'

import type { User } from '@/payload-types'

/**
 * When a reader verifies their email, check every Access Provider's
 * allowedDomains for their email domain or exact address, and attach the
 * first match. Runs again on every update, but bails immediately once
 * accessProvider is set, so it never overwrites a manual assignment.
 */
export const assignAccessProviderOnVerify: CollectionAfterChangeHook<User> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return doc
  if (!doc._verified || previousDoc?._verified) return doc
  if (doc.accessProvider) return doc

  const email = doc.email.toLowerCase()
  const domain = email.split('@')[1]
  if (!domain) return doc

  const matches = await req.payload.find({
    collection: 'access-providers',
    where: {
      or: [
        { 'allowedDomains.domain': { equals: domain } },
        { 'allowedDomains.domain': { equals: email } },
      ],
    },
    limit: 1,
    depth: 0,
    req,
  })

  const provider = matches.docs[0]
  if (!provider) return doc

  await req.payload.update({
    collection: 'users',
    id: doc.id,
    data: { accessProvider: provider.id },
    req,
  })

  return doc
}
