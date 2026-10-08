import type { Access, FieldAccess, Payload, PayloadRequest } from 'payload'

import { staffHasRole } from '@/access/staffRoles'

/** Event marketing info, agenda, sponsors, ticket types: public. */
export const anyoneCanRead: Access = () => true

export const staffCanManageEvents: Access = ({ req }) => staffHasRole(req.user, 'editor')

/** Discount codes, orders and registrations: gatekeeper+ only (brief: gatekeeper manages these). */
export const staffCanManageRegistrations: Access = ({ req }) => staffHasRole(req.user, 'gatekeeper')

function idOf(ref: unknown): number | undefined {
  if (ref == null) return undefined
  if (typeof ref === 'number') return ref
  if (typeof ref === 'object' && 'id' in (ref as Record<string, unknown>)) {
    return (ref as { id: number }).id
  }
  return undefined
}

/** True if `user` (a reader) has an active ticket for `eventId`. Used both as a field-access check and directly by event detail pages. */
export async function hasActiveRegistration(
  payload: Payload,
  user: PayloadRequest['user'],
  eventId: number,
): Promise<boolean> {
  if (user?.collection !== 'users') return false
  const { totalDocs } = await payload.find({
    collection: 'event-registrations',
    where: {
      and: [{ event: { equals: eventId } }, { attendee: { equals: user.id } }, { status: { equals: 'active' } }],
    },
    limit: 0,
    overrideAccess: true,
  })
  return totalDocs > 0
}

/** Field-level access for Session.replayEmbed: staff, or an attendee registered for that session's event, and only once the event's hasReplay flag is on. */
export const canReadReplay: FieldAccess = async ({ req, siblingData, data }) => {
  if (staffHasRole(req.user, 'editor')) return true

  const eventId = idOf(siblingData?.event ?? data?.event)
  if (!eventId) return false

  const event = await req.payload.findByID({ collection: 'events', id: eventId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!event?.hasReplay) return false

  return hasActiveRegistration(req.payload, req.user, eventId)
}
