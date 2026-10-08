import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'

import { commitImport, parseCsv, suggestMapping } from '../../src/lib/datasetImport'

const SAMPLE_DATA_DIR = path.resolve(process.cwd(), 'docs/sample-data')

const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

// A deliberately minimal but valid PDF, just to have real bytes behind the upload.
const MINIMAL_PDF = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF`

export async function seedCountries(payload: Payload) {
  console.log('Seeding countries...')
  const countries = [
    { name: 'United States', iso2: 'US', iso3: 'USA', aliases: ['USA', 'United States of America'] },
    { name: 'United Kingdom', iso2: 'GB', iso3: 'GBR', aliases: ['UK', 'Britain'] },
    { name: 'Germany', iso2: 'DE', iso3: 'DEU', aliases: [] },
    { name: 'Kenya', iso2: 'KE', iso3: 'KEN', aliases: [] },
    { name: 'South Africa', iso2: 'ZA', iso3: 'ZAF', aliases: [] },
    { name: 'India', iso2: 'IN', iso3: 'IND', aliases: [] },
    { name: 'China', iso2: 'CN', iso3: 'CHN', aliases: [] },
    { name: 'Canada', iso2: 'CA', iso3: 'CAN', aliases: [] },
    { name: 'Japan', iso2: 'JP', iso3: 'JPN', aliases: [] },
    { name: 'South Korea', iso2: 'KR', iso3: 'KOR', aliases: ['Korea, South', 'Republic of Korea'] },
    { name: 'Sweden', iso2: 'SE', iso3: 'SWE', aliases: [] },
    { name: 'Brazil', iso2: 'BR', iso3: 'BRA', aliases: [] },
  ]
  for (const c of countries) {
    await payload.create({
      collection: 'countries',
      data: { name: c.name, iso2: c.iso2, iso3: c.iso3, aliases: c.aliases.map((alias) => ({ alias })) },
      overrideAccess: true,
    })
  }
}

const DATASET_DEFS = [
  {
    title: 'Cigarette Market Share by Company',
    slug: 'cigarette-market-share-by-company',
    description: 'Estimated global market share by major manufacturer.',
    icon: '📊',
    columns: [
      { label: 'Company', type: 'text' as const },
      { label: 'Country', type: 'country' as const },
      { label: 'Year', type: 'year' as const },
      { label: 'Market Share', type: 'percent' as const },
    ],
    sampleFile: 'cigarette-market-share-by-company.csv',
  },
  {
    title: 'International Tax Rates',
    slug: 'international-tax-rates',
    description: 'Tobacco excise and consumption tax rates by country.',
    icon: '💰',
    columns: [
      { label: 'Country', type: 'country' as const },
      { label: 'Tax Type', type: 'text' as const },
      { label: 'Rate', type: 'percent' as const },
      { label: 'Year', type: 'year' as const },
    ],
    sampleFile: 'international-tax-rates.csv',
  },
]

/**
 * Creates each Dataset, then runs the *real* import pipeline (the same
 * parseCsv/suggestMapping/commitImport used by the staff upload wizard)
 * against the checked-in sample CSVs, so this seed step is a genuine exercise
 * of the import feature rather than a shortcut that only writes rows directly.
 */
export async function seedDatasets(payload: Payload) {
  console.log('Seeding datasets (via the real CSV import pipeline)...')
  for (const def of DATASET_DEFS) {
    const dataset = await payload.create({
      collection: 'datasets',
      data: {
        title: def.title,
        slug: def.slug,
        description: def.description,
        icon: def.icon,
        columns: def.columns.map((c) => ({
          label: c.label,
          type: c.type,
          filterable: true,
          sortable: true,
          defaultSort: 'none' as const,
        })),
      },
      overrideAccess: true,
    })

    const filePath = path.join(SAMPLE_DATA_DIR, def.sampleFile)
    const buffer = fs.readFileSync(filePath)
    const parsed = parseCsv(buffer.toString('utf-8'))
    const mapping = suggestMapping(parsed.headers, dataset.columns)

    const media = await payload.create({
      collection: 'media',
      data: { alt: `${def.title} — sample import (${def.sampleFile})` },
      // CSV has no magic-byte signature for Payload's file-type sniffing to
      // detect, so pass the mimetype explicitly rather than via filePath.
      file: { data: buffer, mimetype: 'text/csv', name: def.sampleFile, size: buffer.length },
      overrideAccess: true,
    })

    const result = await commitImport({ payload, dataset, parsed, mapping, replace: true, fileId: media.id })
    console.log(`  "${def.title}": imported ${result.rowCount} row(s) from ${def.sampleFile}`)
  }
}

export async function seedGuides(payload: Payload) {
  console.log('Seeding guides...')

  const tmpPdfPath = path.join(os.tmpdir(), 'nic360-guide-placeholder.pdf')
  fs.writeFileSync(tmpPdfPath, MINIMAL_PDF)
  const tmpPngPath = path.join(os.tmpdir(), 'nic360-guide-thumbnail.png')
  fs.writeFileSync(tmpPngPath, Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'))

  const file = await payload.create({
    collection: 'guide-files',
    data: {},
    filePath: tmpPdfPath,
    overrideAccess: true,
  })
  const thumbnail = await payload.create({
    collection: 'media',
    data: { alt: 'Guide thumbnail placeholder' },
    filePath: tmpPngPath,
    overrideAccess: true,
  })

  fs.unlinkSync(tmpPdfPath)
  fs.unlinkSync(tmpPngPath)

  const guides = [
    {
      title: 'Getting Started with Nic360',
      slug: 'getting-started-with-nic360',
      description: 'A short orientation to the site: excerpts, data, publications and events.',
    },
    {
      title: 'Understanding Trademark Filings',
      slug: 'understanding-trademark-filings',
      description: 'How to read USPTO filing, publication and renewal dates in our Trademarks index.',
    },
  ]
  for (const g of guides) {
    await payload.create({
      collection: 'guides',
      data: { ...g, file: file.id, thumbnail: thumbnail.id, _status: 'published' },
      overrideAccess: true,
    })
  }
}
