/**
 * Upserts the full real country list (COUNTRIES, in scripts/seed/data.ts)
 * into the live database by iso2, without duplicating the 12 already
 * seeded. Needed before re-running importDatasets.ts: that migration's
 * first pass showed almost every "country" value outside the original
 * 12-country placeholder list (Afghanistan, Spain, Italy, Argentina,
 * Philippines, ...) falling back to raw text instead of resolving to an
 * iso2 code, simply because those countries didn't exist as records yet.
 *
 * Usage: npx tsx migration/applyFullCountryList.ts
 */
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { COUNTRIES } from '../scripts/seed/data'

async function main() {
  const payload = await getPayload({ config })

  let created = 0
  let updated = 0
  for (const c of COUNTRIES) {
    const data = { name: c.name, iso2: c.iso2, iso3: c.iso3, aliases: (c.aliases ?? []).map((alias) => ({ alias })) }
    const existing = await payload.find({ collection: 'countries', where: { iso2: { equals: c.iso2 } }, limit: 1, overrideAccess: true })
    if (existing.docs.length > 0) {
      await payload.update({ collection: 'countries', id: existing.docs[0].id, data, overrideAccess: true })
      updated++
    } else {
      await payload.create({ collection: 'countries', data, overrideAccess: true })
      created++
    }
  }
  console.log(`${created} created, ${updated} updated. ${COUNTRIES.length} countries total in the list.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
