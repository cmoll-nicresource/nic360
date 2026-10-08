/**
 * Resets and fills every collection with realistic, nicotine/tobacco-industry-flavored
 * placeholder data.
 *
 * Usage: pnpm seed
 */
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
  seedPublications,
} from './seed/publications'
import { seedDiscountCodeAndDemoPurchase, seedEvents, seedSpeakersAndSponsors } from './seed/events'

const ALL = { id: { exists: true } } as const

const WIPE_ORDER = [
  'orders',
  'event-registrations',
  'discount-codes',
  'sessions',
  'events',
  'speakers',
  'sponsors',
  'mailchimp-outbox',
  'email-flags',
  'publication-issues',
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
  await seedIssuesAndSendDemo(payload, publications)
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
  const { gtnf } = await seedEvents(payload, speakers, sponsors)
  await seedDiscountCodeAndDemoPurchase(payload, gtnf.id, async (name) => {
    const { docs } = await payload.find({ collection: 'access-providers', where: { name: { equals: name } }, limit: 1, overrideAccess: true })
    return docs[0]?.id
  })

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
