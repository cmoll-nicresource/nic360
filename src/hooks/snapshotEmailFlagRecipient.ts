import { APIError, type CollectionBeforeValidateHook } from 'payload'

/** Keep the delivery address after PostgreSQL detaches a deleted user. */
export const snapshotEmailFlagRecipient: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!data) return data
  const relationship = data.user === undefined ? originalDoc?.user : data.user
  const userId = relationship && typeof relationship === 'object' ? relationship.id : relationship
  if (operation === 'create' && !userId) {
    throw new APIError('Select a user when creating an email flag.', 400)
  }
  const previousUserId =
    typeof originalDoc?.user === 'object' ? originalDoc.user?.id : originalDoc?.user
  if (originalDoc?.recipientEmail && (!userId || userId === previousUserId)) {
    data.recipientEmail = originalDoc.recipientEmail
    return data
  }
  // Resolve from the account rather than accepting a supplied suppression address.
  const sourceId = userId || previousUserId
  if (sourceId) {
    const user = await req.payload.findByID({
      collection: 'users',
      id: sourceId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    data.recipientEmail = user.email.trim().toLowerCase()
  } else {
    data.recipientEmail = originalDoc?.recipientEmail
  }
  return data
}
