/**
 * Removes the seed script's placeholder demo content now that real
 * migrated data exists for these collections. Deletes in dependency
 * order (same reasoning as scripts/seed.ts's WIPE_ORDER) so required,
 * non-cascading FKs (event-registrations -> orders, livestream-pings ->
 * events/users) don't block.
 *
 * Scope, precisely enumerated from scripts/seed/accounts.ts and
 * scripts/seed/events.ts rather than guessed:
 * - 5 placeholder Staff (@nicotine360.org)
 * - 12 placeholder Users (the fixed email list in seedAccounts, all
 *   fictional people — note several now have a real company as their
 *   accessProvider, since that Access Provider's seed placeholder was
 *   merged into real migrated data by name; the company is real, these
 *   specific people are not)
 * - 2 placeholder Access Providers with no real-world match ("ITC
 *   Limited", "Vapor Ventures LLC") — the other 6 seeded provider names
 *   (Altria Group, Philip Morris International, Juul Labs, British
 *   American Tobacco, Swisher International, Imperial Brands) were
 *   already merged into real data during the accounts migration and are
 *   left alone
 * - The placeholder "InFocus: Harm Reduction Webinar" event (the old site
 *   has zero real InFocus events — the channel exists, this one example
 *   of it doesn't), its 1 session, and everything demo'd against it
 *   (orders, registrations, livestream pings)
 * - The one demo "buy for a colleague" order against the real GTNF 2026
 *   event
 * - Placeholder Articles/Bills/Trademarks (`ingestion.source` is not
 *   'migration') and Publication Issues (`legacyId` is null)
 *
 * Left alone: the 5 placeholder Guides (nothing real replaces them yet)
 * and the demo publication engagement history / ads / email flags, which
 * don't claim to be real people or companies.
 *
 * Usage: npx tsx migration/removeSeedPlaceholders.ts
 */
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config'

const FAKE_STAFF_EMAILS = [
  'papa@nicotine360.org', 'dana@nicotine360.org', 'priya@nicotine360.org',
  'sam@nicotine360.org', 'jordan@nicotine360.org',
]
const FAKE_USER_EMAILS = [
  'rohan.kapoor@gmail.com', 'megan.clarke@altria.com', 'devon.price@altria.com',
  'elena.rossi@pmi.com', 'marcus.webb@pmi.com', 'taylor.nguyen@juul.com',
  'casey.morrison@vaporventures.io', 'ian.fletcher@bat.com', 'lauren.hayes@swisher.com',
  'noah.bennett@imperialbrands.com', 'zoe.harrington@gmail.com', 'harper.diallo@pmi.com',
]
const FAKE_PROVIDER_NAMES = ['ITC Limited', 'Vapor Ventures LLC']
const FAKE_EVENT_NAMES = ['InFocus: Harm Reduction Webinar']

async function deleteWhere(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: Parameters<typeof payload.delete>[0]['collection'],
  where: Parameters<typeof payload.delete>[0]['where'],
  label: string,
) {
  const { docs } = await payload.find({ collection, where, limit: 2000, depth: 0, overrideAccess: true })
  for (const doc of docs) {
    await payload.delete({ collection, id: doc.id, overrideAccess: true })
  }
  console.log(`  ${label}: ${docs.length} deleted`)
  return docs.map((d) => d.id)
}

async function main() {
  const payload = await getPayload({ config })

  console.log('Resolving fake user/event ids...')
  const fakeUserIds = (
    await payload.find({ collection: 'users', where: { email: { in: FAKE_USER_EMAILS } }, limit: 100, depth: 0, overrideAccess: true })
  ).docs.map((d) => d.id)
  const fakeEventIds = (
    await payload.find({ collection: 'events', where: { name: { in: FAKE_EVENT_NAMES } }, limit: 10, depth: 0, overrideAccess: true })
  ).docs.map((d) => d.id)
  // The one demo "buy for a colleague" order against the real GTNF 2026 event.
  const demoOrderIds = (
    await payload.find({ collection: 'orders', where: { buyer: { in: fakeUserIds } }, limit: 100, depth: 0, overrideAccess: true })
  ).docs.map((d) => d.id)

  console.log('\nDeleting in dependency order...')
  await deleteWhere(payload, 'livestream-pings', { user: { in: fakeUserIds } }, 'livestream-pings (fake users)')
  await deleteWhere(payload, 'event-registrations', { or: [{ order: { in: demoOrderIds } }, { event: { in: fakeEventIds } }] }, 'event-registrations')
  await deleteWhere(payload, 'orders', { id: { in: demoOrderIds } }, 'orders')
  await deleteWhere(payload, 'sessions', { event: { in: fakeEventIds } }, 'sessions (fake events)')
  await deleteWhere(payload, 'events', { name: { in: FAKE_EVENT_NAMES } }, 'events (placeholder)')
  // EmailFlags.user is required but its FK is ON DELETE SET NULL — a
  // pre-existing schema inconsistency that would otherwise block this
  // delete with a NOT NULL violation. Worth a real fix later; out of
  // scope for this cleanup.
  await deleteWhere(payload, 'email-flags', { user: { in: fakeUserIds } }, 'email-flags (fake users)')
  await deleteWhere(payload, 'users', { email: { in: FAKE_USER_EMAILS } }, 'users (placeholder)')
  await deleteWhere(payload, 'staff', { email: { in: FAKE_STAFF_EMAILS } }, 'staff (placeholder)')
  await deleteWhere(payload, 'access-providers', { name: { in: FAKE_PROVIDER_NAMES } }, 'access-providers (no real match)')
  await deleteWhere(payload, 'articles', { or: [{ 'ingestion.source': { not_equals: 'migration' } }, { 'ingestion.source': { exists: false } }] }, 'articles (placeholder)')
  await deleteWhere(payload, 'bills', { or: [{ 'ingestion.source': { not_equals: 'migration' } }, { 'ingestion.source': { exists: false } }] }, 'bills (placeholder)')
  await deleteWhere(payload, 'trademarks', { or: [{ 'ingestion.source': { not_equals: 'migration' } }, { 'ingestion.source': { exists: false } }] }, 'trademarks (placeholder)')
  await deleteWhere(payload, 'publication-issues', { legacyId: { exists: false } }, 'publication-issues (placeholder)')

  console.log('\nDone.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
