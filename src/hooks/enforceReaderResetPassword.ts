import { APIError, type CollectionBeforeOperationHook } from 'payload'

/** Match signup's minimum on the actual reset API, including direct clients. */
export const enforceReaderResetPassword: CollectionBeforeOperationHook<'users'> = ({ operation, args }) => {
  if (operation === 'resetPassword' && (typeof args.data.password !== 'string' || args.data.password.length < 8))
    throw new APIError('Use a password with at least 8 characters.', 400)
}
