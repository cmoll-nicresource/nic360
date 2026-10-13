/**
 * Builds out the Locations tree (region > country > state) from real data
 * and tags migrated Articles/Bills with it.
 *
 * The real source is the old site's `addresses` table — a polymorphic,
 * Google-Places-backed association (`addressable_type`/`addressable_id`)
 * that isn't named anything like "location", which is why the first pass
 * at this migration missed it entirely. Each tagged place becomes MULTIPLE
 * rows (one per hierarchy level — region, country, and sometimes state),
 * all stored in the same oddly-named `country` text column regardless of
 * which level it actually represents; there's no explicit level flag, so
 * level is inferred here by matching the text against a known region/
 * country/state list.
 *
 * Scope, confirmed: region/country/state only — the real data also has a
 * long tail of ~80 one-off cities/counties (mostly 1-3 uses each), left
 * out for now. A handful of non-geographic "region" values in the old
 * data (World, European Union, Non-European Union) are dropped; a few
 * informal sub-regions (Middle East, Caribbean, Latin America, Central
 * America, Western Europe, Northern Africa) are folded into their nearest
 * real continent rather than creating confusing parallel region nodes.
 *
 * Usage: npx tsx migration/buildLocationsAndTagExcerpts.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import zlib from 'zlib'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { COUNTRIES } from '../scripts/seed/data'

const DUMP_PATH = path.join(process.cwd(), 'old-db', 'truecms.sql.gz')
const NULL = '\\N'

async function streamTable(tableName: string, onRow: (fields: string[]) => void): Promise<void> {
  const copyPrefix = `COPY public.${tableName} (`
  let inBlock = false
  const rl = readline.createInterface({
    input: fs.createReadStream(DUMP_PATH).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    if (!inBlock) {
      if (line.startsWith(copyPrefix)) inBlock = true
      continue
    }
    if (line === '\\.') break
    await onRow(line.split('\t'))
  }
  rl.close()
}

const REGIONS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'] as const

// Informal sub-regions seen in the real data, folded onto their nearest
// real continent rather than kept as separate parallel region nodes.
const REGION_ALIASES: Record<string, (typeof REGIONS)[number]> = {
  'Middle East': 'Asia',
  'Middle East And Africa': 'Asia',
  'Northern Africa': 'Africa',
  'Latin America': 'South America',
  'Central America': 'North America',
  Caribbean: 'North America',
  'Western Europe': 'Europe',
}
// Not real geographic entities — dropped rather than mapped.
const SKIP_REGION_VALUES = new Set(['World', 'European Union', 'Non-European Union'])

const COUNTRY_TO_REGION: Record<string, (typeof REGIONS)[number]> = {
  Algeria: 'Africa', Angola: 'Africa', Benin: 'Africa', Botswana: 'Africa', 'Burkina Faso': 'Africa',
  Burundi: 'Africa', Cameroon: 'Africa', 'Cape Verde': 'Africa', 'Central African Republic': 'Africa',
  Chad: 'Africa', Comoros: 'Africa', Congo: 'Africa', 'Democratic Republic of the Congo': 'Africa',
  Djibouti: 'Africa', Egypt: 'Africa', 'Equatorial Guinea': 'Africa', Eritrea: 'Africa', Eswatini: 'Africa',
  Ethiopia: 'Africa', Gabon: 'Africa', Gambia: 'Africa', Ghana: 'Africa', Guinea: 'Africa',
  'Guinea-Bissau': 'Africa', 'Ivory Coast': 'Africa', Kenya: 'Africa', Lesotho: 'Africa', Liberia: 'Africa',
  Libya: 'Africa', Madagascar: 'Africa', Malawi: 'Africa', Mali: 'Africa', Mauritania: 'Africa',
  Mauritius: 'Africa', Morocco: 'Africa', Mozambique: 'Africa', Namibia: 'Africa', Niger: 'Africa',
  Nigeria: 'Africa', Rwanda: 'Africa', 'Sao Tome and Principe': 'Africa', Senegal: 'Africa',
  Seychelles: 'Africa', 'Sierra Leone': 'Africa', Somalia: 'Africa', 'South Africa': 'Africa',
  'South Sudan': 'Africa', Sudan: 'Africa', Tanzania: 'Africa', Togo: 'Africa', Tunisia: 'Africa',
  Uganda: 'Africa', Zambia: 'Africa', Zimbabwe: 'Africa',

  Afghanistan: 'Asia', Armenia: 'Asia', Azerbaijan: 'Asia', Bahrain: 'Asia', Bangladesh: 'Asia',
  Bhutan: 'Asia', Brunei: 'Asia', Cambodia: 'Asia', China: 'Asia', Georgia: 'Asia', 'Hong Kong': 'Asia',
  India: 'Asia', Indonesia: 'Asia', Iran: 'Asia', Iraq: 'Asia', Israel: 'Asia', Japan: 'Asia',
  Jordan: 'Asia', Kazakhstan: 'Asia', Kuwait: 'Asia', Kyrgyzstan: 'Asia', Laos: 'Asia', Lebanon: 'Asia',
  Malaysia: 'Asia', Maldives: 'Asia', Mongolia: 'Asia', Myanmar: 'Asia', Nepal: 'Asia', 'North Korea': 'Asia',
  Oman: 'Asia', Pakistan: 'Asia', Palestine: 'Asia', Philippines: 'Asia', Qatar: 'Asia',
  'Saudi Arabia': 'Asia', Singapore: 'Asia', 'South Korea': 'Asia', 'Sri Lanka': 'Asia', Syria: 'Asia',
  Taiwan: 'Asia', Tajikistan: 'Asia', Thailand: 'Asia', 'Timor-Leste': 'Asia', Turkey: 'Asia',
  Turkmenistan: 'Asia', 'United Arab Emirates': 'Asia', Uzbekistan: 'Asia', Vietnam: 'Asia', Yemen: 'Asia',

  Albania: 'Europe', Andorra: 'Europe', Austria: 'Europe', Belarus: 'Europe', Belgium: 'Europe',
  'Bosnia and Herzegovina': 'Europe', Bulgaria: 'Europe', Croatia: 'Europe', Cyprus: 'Europe',
  'Czech Republic': 'Europe', Denmark: 'Europe', Estonia: 'Europe', Finland: 'Europe', France: 'Europe',
  Germany: 'Europe', Greece: 'Europe', Hungary: 'Europe', Iceland: 'Europe', Ireland: 'Europe',
  Italy: 'Europe', Kosovo: 'Europe', Latvia: 'Europe', Liechtenstein: 'Europe', Lithuania: 'Europe',
  Luxembourg: 'Europe', Malta: 'Europe', Moldova: 'Europe', Monaco: 'Europe', Montenegro: 'Europe',
  Netherlands: 'Europe', 'North Macedonia': 'Europe', Norway: 'Europe', Poland: 'Europe', Portugal: 'Europe',
  Romania: 'Europe', Russia: 'Europe', 'San Marino': 'Europe', Serbia: 'Europe', Slovakia: 'Europe',
  Slovenia: 'Europe', Spain: 'Europe', Sweden: 'Europe', Switzerland: 'Europe', Ukraine: 'Europe',
  'United Kingdom': 'Europe', 'Vatican City': 'Europe',

  'Antigua and Barbuda': 'North America', Bahamas: 'North America', Barbados: 'North America',
  Belize: 'North America', Canada: 'North America', 'Costa Rica': 'North America', Cuba: 'North America',
  Dominica: 'North America', 'Dominican Republic': 'North America', 'El Salvador': 'North America',
  Grenada: 'North America', Guatemala: 'North America', Haiti: 'North America', Honduras: 'North America',
  Jamaica: 'North America', Mexico: 'North America', Nicaragua: 'North America', Panama: 'North America',
  'Saint Kitts and Nevis': 'North America', 'Saint Lucia': 'North America',
  'Saint Vincent and the Grenadines': 'North America', 'Trinidad and Tobago': 'North America',
  'United States': 'North America',

  Argentina: 'South America', Bolivia: 'South America', Brazil: 'South America', Chile: 'South America',
  Colombia: 'South America', Ecuador: 'South America', Guyana: 'South America', Paraguay: 'South America',
  Peru: 'South America', Suriname: 'South America', Uruguay: 'South America', Venezuela: 'South America',

  Australia: 'Oceania', Fiji: 'Oceania', Kiribati: 'Oceania', 'Marshall Islands': 'Oceania',
  Micronesia: 'Oceania', Nauru: 'Oceania', 'New Zealand': 'Oceania', Palau: 'Oceania',
  'Papua New Guinea': 'Oceania', Samoa: 'Oceania', 'Solomon Islands': 'Oceania', Tonga: 'Oceania',
  Tuvalu: 'Oceania', Vanuatu: 'Oceania',
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Puerto Rico', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
  'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'Guam',
]
const CANADA_PROVINCES = [
  'Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia',
  'New Brunswick', 'Newfoundland and Labrador', 'Prince Edward Island', 'Nunavut',
  'Northwest Territories', 'Yukon',
]
const AUSTRALIA_STATES = [
  'New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania',
  'Northern Territory', 'Australian Capital Territory',
]
const UK_CONSTITUENT_COUNTRIES = ['England', 'Scotland', 'Wales', 'Northern Ireland']
const INDIA_STATES = ['Karnataka', 'Assam', 'Jammu and Kashmir']

const STATE_TO_COUNTRY: Record<string, string> = Object.fromEntries([
  ...US_STATES.map((s) => [s, 'United States']),
  ...CANADA_PROVINCES.map((s) => [s, 'Canada']),
  ...AUSTRALIA_STATES.map((s) => [s, 'Australia']),
  ...UK_CONSTITUENT_COUNTRIES.map((s) => [s, 'United Kingdom']),
  ...INDIA_STATES.map((s) => [s, 'India']),
])

async function main() {
  const payload = await getPayload({ config })

  console.log('Building regions...')
  const regionIdByName = new Map<string, string | number>()
  for (const name of REGIONS) {
    const existing = await payload.find({ collection: 'locations', where: { name: { equals: name }, level: { equals: 'region' } }, limit: 1, overrideAccess: true })
    const doc =
      existing.docs.length > 0
        ? existing.docs[0]
        : await payload.create({ collection: 'locations', data: { name, level: 'region' }, overrideAccess: true })
    regionIdByName.set(name, doc.id)
  }

  console.log('Building countries...')
  const countryIdByName = new Map<string, string | number>()
  for (const c of COUNTRIES) {
    const region = COUNTRY_TO_REGION[c.name]
    const parent = region ? regionIdByName.get(region) : undefined
    const data = { name: c.name, level: 'country' as const, parent }
    const existing = await payload.find({ collection: 'locations', where: { name: { equals: c.name }, level: { equals: 'country' } }, limit: 1, overrideAccess: true })
    const doc =
      existing.docs.length > 0
        ? await payload.update({ collection: 'locations', id: existing.docs[0].id, data, overrideAccess: true })
        : await payload.create({ collection: 'locations', data, overrideAccess: true })
    countryIdByName.set(c.name, doc.id)
  }

  console.log('Building states/provinces...')
  const stateIdByName = new Map<string, string | number>()
  for (const [stateName, countryName] of Object.entries(STATE_TO_COUNTRY)) {
    const parent = countryIdByName.get(countryName)
    const data = { name: stateName, level: 'state' as const, parent }
    const existing = await payload.find({ collection: 'locations', where: { name: { equals: stateName }, level: { equals: 'state' } }, limit: 1, overrideAccess: true })
    const doc =
      existing.docs.length > 0
        ? await payload.update({ collection: 'locations', id: existing.docs[0].id, data, overrideAccess: true })
        : await payload.create({ collection: 'locations', data, overrideAccess: true })
    stateIdByName.set(stateName, doc.id)
  }
  console.log(`  ${regionIdByName.size} regions, ${countryIdByName.size} countries, ${stateIdByName.size} states`)

  /** Resolves one old free-text address value to a Location id, or undefined if out of scope (city-level, or non-geographic). */
  function resolveLocation(raw: string): string | number | undefined {
    const value = raw.trim()
    if (SKIP_REGION_VALUES.has(value)) return undefined
    if ((REGIONS as readonly string[]).includes(value)) return regionIdByName.get(value)
    if (REGION_ALIASES[value]) return regionIdByName.get(REGION_ALIASES[value])
    if (countryIdByName.has(value)) return countryIdByName.get(value)
    if (stateIdByName.has(value)) return stateIdByName.get(value)
    return undefined // city-level or unrecognized — out of scope for this pass
  }

  console.log('\nReading old addresses for Articles/Bills...')
  const valuesByExcerpt = new Map<string, Set<string>>() // `${type}:${oldId}` -> raw text values
  await streamTable('addresses', (f) => {
    const type = f[1]
    if (type !== 'Article' && type !== 'Bill') return
    const oldId = f[2]
    const value = f[8]
    if (value === NULL || !value.trim()) return
    const key = `${type}:${oldId}`
    const set = valuesByExcerpt.get(key) ?? new Set<string>()
    set.add(value)
    valuesByExcerpt.set(key, set)
  })
  console.log(`  ${valuesByExcerpt.size} tagged Articles/Bills`)

  console.log('\nTagging migrated Articles and Bills...')
  const stats = { Article: { tagged: 0, notFound: 0 }, Bill: { tagged: 0, notFound: 0 } }
  for (const [key, values] of valuesByExcerpt) {
    const [type, oldId] = key.split(':') as ['Article' | 'Bill', string]
    const locationIds = [...values].map(resolveLocation).filter((id): id is string | number => id !== undefined)
    if (locationIds.length === 0) continue

    const collection = type === 'Article' ? 'articles' : 'bills'
    const { docs } = await payload.find({
      collection,
      where: { and: [{ 'ingestion.source': { equals: 'migration' } }, { 'ingestion.externalId': { equals: oldId } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (docs.length === 0) {
      stats[type].notFound++
      continue
    }
    await payload.update({ collection, id: docs[0].id, data: { locations: locationIds }, overrideAccess: true })
    stats[type].tagged++
  }

  console.log(`  Articles: ${stats.Article.tagged} tagged, ${stats.Article.notFound} not found`)
  console.log(`  Bills: ${stats.Bill.tagged} tagged, ${stats.Bill.notFound} not found`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
