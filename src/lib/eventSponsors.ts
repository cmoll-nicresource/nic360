import type { Payload } from 'payload'
import type { Event, Sponsor } from '@/payload-types'

/**
 * The sponsors of the given events with their logos loaded, in the order
 * staff arranged them, each once. A separate small query, so listing pages
 * don't have to load every event two levels deep just to reach the logos.
 */
export async function loadEventSponsors(
  payload: Payload,
  lists: Event['sponsors'][],
): Promise<Sponsor[]> {
  const ids: number[] = []
  for (const list of lists)
    for (const sponsor of list ?? []) {
      const id = typeof sponsor === 'object' ? sponsor?.id : sponsor
      if (id != null && !ids.includes(id)) ids.push(id)
    }
  if (!ids.length) return []
  const { docs } = await payload.find({
    collection: 'sponsors',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 1,
    overrideAccess: false,
  })
  const byId = new Map(docs.map((sponsor) => [sponsor.id, sponsor]))
  return ids.map((id) => byId.get(id)).filter((sponsor): sponsor is Sponsor => !!sponsor)
}
