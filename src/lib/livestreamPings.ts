import type { Payload } from 'payload'

/** Logs one presence ping — each call is independent, unlike the accumulated counters elsewhere in this codebase, since a ping log (not a duration total) is what lets the attendee report match pings against the session schedule later. */
export async function recordLivestreamPing(payload: Payload, eventId: number, userId: number): Promise<void> {
  await payload.create({
    collection: 'livestream-pings',
    data: { event: eventId, user: userId },
    overrideAccess: true,
  })
}
