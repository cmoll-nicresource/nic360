import type { CollectionAfterOperationHook } from 'payload'

/**
 * Completing a password reset proves the user controls the mailbox the link was
 * sent to, so an unverified account becomes verified. Verifying here also lets
 * the access-provider domain match run, as it does for any verification.
 */
export const verifyOnPasswordReset: CollectionAfterOperationHook<'users'> = async ({ operation, result, args }) => {
  if (operation !== 'resetPassword') return result
  const user = (result as { user?: { id: number; _verified?: boolean | null } }).user
  if (!user || user._verified) return result
  await args.req.payload.update({
    collection: 'users',
    id: user.id,
    data: { _verified: true } as never,
    overrideAccess: true,
    req: args.req,
  })
  return result
}
