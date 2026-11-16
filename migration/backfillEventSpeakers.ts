/**
 * Fills each Event's `speakers` roster from the speakers and moderators on its
 * sessions. The original events import attached speakers only to sessions, so
 * migrated events showed no speakers. Existing roster entries are kept.
 * Needs no old-site dump; reads the current database only.
 *
 * Usage: npx tsx migration/backfillEventSpeakers.ts [--dry-run]
 */
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config'

const idOf = (ref: unknown): number | undefined =>
  typeof ref === 'number' ? ref : ref && typeof ref === 'object' && 'id' in ref ? (ref as { id: number }).id : undefined

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const payload = await getPayload({ config })

  const roster = new Map<number, Set<number>>()
  let page = 1
  for (;;) {
    const res = await payload.find({
      collection: 'sessions',
      depth: 0,
      limit: 500,
      page,
      draft: true,
      overrideAccess: true,
    })
    for (const s of res.docs) {
      const eventId = idOf(s.event)
      if (!eventId) continue
      const set = roster.get(eventId) ?? new Set<number>()
      for (const ref of [...(s.speakers ?? []), ...(s.moderators ?? [])]) {
        const id = idOf(ref)
        if (id) set.add(id)
      }
      roster.set(eventId, set)
    }
    if (!res.hasNextPage) break
    page++
  }

  let updated = 0
  for (const [eventId, ids] of roster) {
    const event = await payload.findByID({ collection: 'events', id: eventId, depth: 0, overrideAccess: true })
    const merged = new Set<number>([...(event.speakers ?? []).map(idOf).filter((n): n is number => !!n), ...ids])
    if (merged.size === (event.speakers ?? []).length) continue
    console.log(`${event.name}: ${(event.speakers ?? []).length} -> ${merged.size} speakers`)
    if (!dryRun) {
      await payload.update({ collection: 'events', id: eventId, data: { speakers: [...merged] }, overrideAccess: true })
    }
    updated++
  }
  console.log(`${dryRun ? 'Would update' : 'Updated'} ${updated} of ${roster.size} events with sessions`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
