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

const ALL = { id: { exists: true } } as const

const WIPE_ORDER = [
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
