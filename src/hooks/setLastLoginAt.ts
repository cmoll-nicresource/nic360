import type { CollectionAfterLoginHook } from 'payload'

import type { User } from '@/payload-types'

/** Stamps `lastLoginAt` on every successful login. Only touches that one field, so it never re-triggers the Mailchimp sync or access-provider hooks. */
export const setLastLoginAt: CollectionAfterLoginHook<User> = async ({ req, user }) => {
  await req.payload.update({
    collection: 'users',
    id: user.id,
    data: { lastLoginAt: new Date().toISOString() },
    overrideAccess: true,
    req,
  })
}
