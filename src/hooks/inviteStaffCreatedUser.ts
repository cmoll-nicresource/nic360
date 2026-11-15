import type { CollectionAfterChangeHook, CollectionBeforeOperationHook } from 'payload'

import { passwordResetEmail } from '@/lib/accountEmail'

/**
 * Users staff create in the admin get an invitation to set their own password,
 * not a bare "confirm your email" message. The password staff typed is only a
 * placeholder and is never emailed. Payload's own verification email is
 * suppressed for these accounts; following the invitation link proves the
 * address (see verifyOnPasswordReset).
 */
const createdByStaff = (req: { user?: { collection?: string } | null }) => req.user?.collection === 'staff'

export const skipVerificationForStaffCreated: CollectionBeforeOperationHook<'users'> = ({ operation, args, req }) => {
  if (operation === 'create' && createdByStaff(req)) return { ...args, disableVerificationEmail: true }
  return args
}

export const inviteStaffCreatedUser: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || !createdByStaff(req) || doc._verified) return doc
  // Payload's own reset email looks the user up outside this still-open
  // transaction and would not find them yet, so request only the token (which
  // runs inside it) and send the invitation ourselves.
  const token = await req.payload.forgotPassword({
    collection: 'users',
    data: { email: doc.email },
    disableEmail: true,
    req,
  })
  await req.payload.sendEmail({
    to: doc.email,
    subject: 'Your Nicotine360 account is ready',
    html: passwordResetEmail({ token, name: doc.firstName, accountInvite: true }),
  })
  return doc
}
