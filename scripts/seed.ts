/**
 * Resets and fills every collection with realistic, nicotine/tobacco-industry-flavored
 * placeholder data.
 *
 * Usage: pnpm seed
 */
import 'dotenv/config' // next dev/build load .env automatically; running via tsx directly does not.
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { getReaderPlan } from '../src/access/readerPlan'
import { SEED_PASSWORD, seedAccounts } from './seed/accounts'
import { seedCountries, seedDatasets, seedGuides } from './seed/data'
import { seedExcerptContent } from './seed/excerpts'
import {
  seedEmailFlags,
  seedIssuesAndSendDemo,
  seedMailchimpSettings,
  seedPublicationAds,
  seedPublicationEngagementHistory,
  seedPublications,
} from './seed/publications'
import {
  seedDiscountCodeAndDemoPurchase,
  seedEvents,
  seedSpeakersAndSponsors,
  seedVirtualAttendeesAndWatchData,
} from './seed/events'

const ALL = { id: { exists: true } } as const

const WIPE_ORDER = [
  // event-registrations must be wiped before orders: it holds a required,
  // non-cascading FK to orders, so deleting orders first aborts the
  // transaction with "current transaction is aborted" on whatever runs next.
  'event-registrations',
  'orders',
  'discount-codes',
  // livestream-pings holds required relationships to both events and users
  // (blocking, non-cascading FKs per the established pattern), so it must
  // be wiped before either.
  'livestream-pings',
  'sessions',
  'events',
  'speakers',
  'sponsors',
  'mailchimp-outbox',
  'page-views',
  'email-flags',
  // ses-outbox references publication-issues via an optional relationship,
  // which Payload backs with an ON DELETE SET NULL FK (verified against the
  // real schema) — order here isn't strictly required, unlike
  // event-registrations/orders above, but wiping it first costs nothing.
  'ses-outbox',
  'publication-issues',
  // publication-ads holds required relationships to both publications and
  // media (blocking, non-cascading FKs per the established pattern — see
  // the event-registrations/orders note above), so it must be wiped first.
  'publication-ads',
  'publications',
  'trademark-import-runs',
  'bills',
  'articles',
  'trademarks',
  'subjects',
  'locations',
  'sectors',
  'products',
  'sources',
  'dataset-rows',
  'datasets',
  'guides',
  'guide-files',
  'countries',
  'users',
  'staff',
  'access-providers',
  'media',
] as const

async function wipe(payload: Awaited<ReturnType<typeof getPayload>>) {
  for (const collection of WIPE_ORDER) {
    await payload.delete({ collection, where: ALL, overrideAccess: true })
  }
}

async function main() {
  const payload = await getPayload({ config })

  console.log('Wiping all seeded collections...')
  await wipe(payload)

  await seedAccounts(payload)
  await seedExcerptContent(payload)
  await seedCountries(payload)
  await seedDatasets(payload)
  await seedGuides(payload)

  await seedMailchimpSettings(payload)
  const publications = await seedPublications(payload)
  await seedPublicationAds(payload, publications)
  await seedIssuesAndSendDemo(payload, publications)
  await seedPublicationEngagementHistory(payload, publications)
  await seedEmailFlags(payload, publications)

  console.log('Setting a couple of readers\' publication preferences (exercises the Mailchimp sync hook)...')
  for (const email of ['megan.clarke@altria.com', 'elena.rossi@pmi.com']) {
    const { docs } = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
    if (docs[0]) {
      await payload.update({
        collection: 'users',
        id: docs[0].id,
        data: { emailPublications: [publications['us-news-clippings'], publications['monthly-research-digest']] },
        overrideAccess: true,
      })
    }
  }

  const { speakers, sponsors } = await seedSpeakersAndSponsors(payload)
  const { gtnf, infocus } = await seedEvents(payload, speakers, sponsors)
  await seedDiscountCodeAndDemoPurchase(payload, gtnf.id, async (name) => {
    const { docs } = await payload.find({ collection: 'access-providers', where: { name: { equals: name } }, limit: 1, overrideAccess: true })
    return docs[0]?.id
  })
  await seedVirtualAttendeesAndWatchData(payload, infocus.id)

  console.log('\nAccess summary (via getReaderPlan, the shared helper):\n')
  const { docs: allUsers } = await payload.find({
    collection: 'users',
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })
  const rows = await Promise.all(
    allUsers.map(async (u) => ({
      email: u.email,
      provider: u.accessProvider && typeof u.accessProvider === 'object' ? u.accessProvider.name : '(none)',
      plan: await getReaderPlan(u, payload),
    })),
  )
  console.table(rows)

  console.log(`\nSeed complete. Every seeded account's password is: ${SEED_PASSWORD}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
