import { mkdir, writeFile, readFile } from 'node:fs/promises'
import pg from 'pg'
import type { CollectionSlug } from 'payload'
import { applyTestEnvironment } from './environment'
import { lexicalFromText } from '../../src/lib/lexical'
applyTestEnvironment()
if (process.argv.includes('--reset')) {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
  await client.connect()
  try {
    await client.query('DROP SCHEMA IF EXISTS clipper CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  } finally {
    await client.end()
  }
}
const { getPayload } = await import('payload'),
  { default: config } = await import('../../src/payload.config')
const { seedPublications } = await import('../../scripts/seed/publications')
const { repairPublicationSelectionRules } =
  await import('../../src/lib/repairPublicationSelectionRules')
const payload = await getPayload({ config })
await payload.db.pool.query(await readFile('migration/extensionConnections.sql', 'utf8'))
if ((await payload.count({ collection: 'staff', overrideAccess: true })).totalDocs)
  throw new Error(
    'Test seed requires an empty isolated database. Recreate only the test database before rerunning.',
  )
const password = 'test-only-Password-2026!',
  records: { collection: CollectionSlug; id: number }[] = []
async function add<T extends CollectionSlug>(
  collection: T,
  data: Record<string, unknown>,
  file?: Buffer,
) {
  const doc = await payload.create({
    collection,
    data: data as never,
    overrideAccess: true,
    disableVerificationEmail: true,
    ...(file
      ? {
          file: {
            data: file,
            mimetype: 'application/pdf',
            name: 'e2e-' + crypto.randomUUID() + '.pdf',
            size: file.length,
          },
        }
      : {}),
  })
  records.push({ collection, id: doc.id })
  return doc
}
const refs: Record<string, number> = {}
refs.northAmerica = (await add('locations', { name: 'North America', level: 'region' })).id
refs.asia = (await add('locations', { name: 'Asia', level: 'region' })).id
refs.us = (
  await add('locations', { name: 'United States', level: 'country', parent: refs.northAmerica })
).id
refs.state = (await add('locations', { name: 'Pennsylvania', level: 'state', parent: refs.us })).id
refs.china = (await add('locations', { name: 'China', level: 'country', parent: refs.asia })).id
refs.uk = (await add('locations', { name: 'United Kingdom', level: 'country' })).id
for (const name of [
  'Vapor/E-liquid',
  'Vapors/Tanks/Mods (VTMs)',
  'Electronic Cigarettes (e-cigarettes)',
  'E-Liquid',
])
  refs[name] = (await add('products', { name })).id
refs.subject = (await add('subjects', { name: 'Regulation', legacyId: 'synthetic-old-subject' })).id
refs.source = (await add('sources', { name: 'Synthetic test news' })).id
const publications = await seedPublications(payload)
// Rehearse imported configuration errors, then run the actual repeatable repair.
await payload.update({
  collection: 'publications',
  id: publications['us-news-clippings'],
  data: { selectionRules: { locations: { include: [] } } },
  overrideAccess: true,
})
await payload.update({
  collection: 'publications',
  id: publications['global-news-clippings'],
  data: { selectionRules: { excerptTypes: ['articles', 'bills'], locations: { exclude: [] } } },
  overrideAccess: true,
})
await payload.update({
  collection: 'publications',
  id: publications['vapor-news-clippings'],
  data: { selectionRules: { products: { include: [refs['Vapor/E-liquid']] } } },
  overrideAccess: true,
})
await repairPublicationSelectionRules(payload, true)
if ((await repairPublicationSelectionRules(payload)).changes.length)
  throw new Error('Publication configuration repair is not repeatable')
const articles: Record<string, number> = {}
for (const [key, locations, products, status, date] of [
  ['us', [refs.us], [], 'published', '2090-10-15'],
  ['china', [refs.china], [], 'published', '2090-10-15'],
  ['mixed', [refs.us, refs.china], [], 'published', '2090-10-15'],
  ['state', [refs.state], [], 'published', '2090-10-15'],
  ['usVapor', [refs.us], [refs['Vapors/Tanks/Mods (VTMs)']], 'published', '2090-10-15'],
  ['ukVapor', [refs.uk], [refs['E-Liquid']], 'published', '2090-10-15'],
  ['untagged', [], [], 'published', '2090-10-15'],
  ['draft', [refs.us], [], 'draft', '2090-10-15'],
  ['future', [refs.us], [], 'published', '2090-10-17'],
] as const)
  articles[key] = (
    await add('articles', {
      title: 'Fixture ' + key,
      locations: [...locations],
      products: [...products],
      sourceDate: date + 'T12:00:00Z',
      excerpt: lexicalFromText(
        'Synthetic full excerpt for ' + key + '. This body is different from its headline.',
      ),
      source: refs.source,
      subjects: [refs.subject],
      primarySubject: refs.subject,
      _status: status,
    })
  ).id
refs.bill = (
  await add('bills', {
    title: 'Fixture US bill',
    billType: 'Bill',
    billNumber: 'S.123',
    billDate: '2090-10-15T12:00:00Z',
    locations: [refs.us],
    abstract: lexicalFromText('Synthetic legislation abstract.'),
    fullText: lexicalFromText('Synthetic complete bill text.'),
    _status: 'published',
  })
).id
const staff: Record<string, { id: number; email: string }> = {}
for (const role of ['editor', 'gatekeeper', 'admin']) {
  const doc = await add('staff', {
    name: 'Fixture ' + role,
    email: role + '@staff.example.invalid',
    password,
    role,
  })
  staff[role] = { id: doc.id, email: doc.email }
}
const providers: Record<string, number> = {}
for (const plan of ['none', 'base', 'premium'])
  providers[plan] = (
    await add('access-providers', {
      name: 'Fixture ' + plan,
      plan,
      status: 'live',
      ...(plan === 'premium' ? { allowedDomains: [{ domain: 'signup.example.invalid' }] } : {}),
    })
  ).id
providers.expired = (
  await add('access-providers', {
    name: 'Fixture expired',
    plan: 'premium',
    status: 'live',
    licenseExpiresAt: '2000-01-01',
  })
).id
const readers: Record<string, { id: number; email: string }> = {}
for (const kind of ['none', 'base', 'premium', 'suspended', 'unverified', 'expired']) {
  const doc = await add('users', {
    email: kind + '@reader.example.invalid',
    password,
    firstName: 'Fixture',
    lastName: kind,
    status: kind === 'suspended' ? 'suspended' : 'active',
    _verified: kind !== 'unverified',
    accessProvider: providers[kind] ?? providers.premium,
    signup: { completedAt: new Date().toISOString() },
  })
  readers[kind] = { id: doc.id, email: doc.email }
}
const pdf = await readFile('src/lib/ttb/fixtures/cbp-2026-10-13.pdf')
const files: Record<string, { id: number; filename: string }> = {}
for (const kind of ['base', 'premium', 'draft']) {
  const file = await add('guide-files', {}, pdf)
  files[kind] = { id: file.id, filename: String(file.filename) }
  await add('guides', {
    title: 'Fixture ' + kind + ' guide',
    slug: 'fixture-' + kind + '-guide',
    file: file.id,
    requiresPremium: kind !== 'base',
    _status: kind === 'draft' ? 'draft' : 'published',
  })
}
refs.dataset = (
  await add('datasets', {
    title: 'Fixture data',
    slug: 'fixture-data',
    category: 'markets',
    columns: [
      { label: 'Country', key: 'country', type: 'text' },
      { label: 'Value', key: 'value', type: 'number' },
    ],
  })
).id
for (let i = 0; i < 20; i++)
  await add('dataset-rows', { dataset: refs.dataset, values: { country: 'Test ' + i, value: i } })
refs.event = (
  await add('events', {
    name: 'Fixture conference',
    channel: 'infocus',
    startsAt: '2090-10-01T12:00:00Z',
    endDate: '2090-10-02T12:00:00Z',
    ticketTypes: [{ name: 'General', price: 0, onSale: true }],
    _status: 'published',
  })
).id
refs.pastEvent = (await add('events', { name: 'Fixture past conference', channel: 'infocus', startsAt: '2000-10-01T12:00:00Z', endDate: '2000-10-02T00:00:00Z', _status: 'published' })).id
const issue = await add('publication-issues', {
  legacyId: 'synthetic-old-issue',
  publication: publications['us-news-clippings'],
  issueDate: '2090-10-16T12:00:00Z',
  format: 'excerpt-list',
  _status: 'draft',
})
refs.issue = issue.id
// Exercise pagination and reporting with synthetic volume, without thousands of hook calls.
const volume = new pg.Client({ connectionString: process.env.DATABASE_URI })
await volume.connect()
await volume.query(`INSERT INTO dataset_rows (dataset_id, values)
  SELECT $1, jsonb_build_object('country', 'Scale ' || n, 'value', n)
  FROM generate_series(20, 5019) n`, [refs.dataset])
await volume.query(`INSERT INTO page_views (visitor_id, path, created_at, updated_at)
  SELECT $1, '/articles/fixture-us', timestamp '2090-10-15 12:00:00', timestamp '2090-10-15 12:00:00'
  FROM generate_series(1, 15000)`, [readers.premium.id])
await volume.end()
await mkdir('.test-artifacts', { recursive: true })
await writeFile(
  '.test-artifacts/fixtures.json',
  JSON.stringify(
    { password, staff, readers, providers, refs, articles, publications, files, records },
    null,
    2,
  ),
)
console.log('Isolated synthetic fixtures prepared; no real accounts, storage or providers used.')
await payload.destroy()
process.exit(0)
