import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'

import { lexicalFromText } from './lexical'

// A 1x1 transparent PNG, reused as the placeholder trademark filing image.
const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

type Ids = Record<string, number>

async function seedLocations(payload: Payload): Promise<Ids> {
  const ids: Ids = {}

  const regions = ['North America', 'Europe', 'Africa', 'Asia']
  for (const name of regions) {
    const doc = await payload.create({
      collection: 'locations',
      data: { name, level: 'region' },
      overrideAccess: true,
    })
    ids[name] = doc.id
  }

  const countries: Array<[name: string, region: string]> = [
    ['United States', 'North America'],
    ['Canada', 'North America'],
    ['United Kingdom', 'Europe'],
    ['Germany', 'Europe'],
    ['Kenya', 'Africa'],
    ['South Africa', 'Africa'],
    ['India', 'Asia'],
    ['China', 'Asia'],
  ]
  for (const [name, region] of countries) {
    const doc = await payload.create({
      collection: 'locations',
      data: { name, level: 'country', parent: ids[region] },
      overrideAccess: true,
    })
    ids[name] = doc.id
  }

  const states: Array<[name: string, country: string]> = [
    ['Pennsylvania', 'United States'],
    ['California', 'United States'],
    ['New York', 'United States'],
  ]
  for (const [name, country] of states) {
    const doc = await payload.create({
      collection: 'locations',
      data: { name, level: 'state', parent: ids[country] },
      overrideAccess: true,
    })
    ids[name] = doc.id
  }

  return ids
}

async function seedFlatTaxonomy(
  payload: Payload,
  collection: 'sectors' | 'products' | 'sources',
  rows: Array<{ name: string; domain?: string }>,
): Promise<Ids> {
  const ids: Ids = {}
  for (const row of rows) {
    const doc = await payload.create({ collection, data: row, overrideAccess: true })
    ids[row.name] = doc.id
  }
  return ids
}

async function seedSubjects(payload: Payload): Promise<Ids> {
  const ids: Ids = {}
  const tree: Record<string, string[]> = {
    'REGULATION & POLICY': ['Flavor Bans', 'Taxation', 'Age Verification'],
    'RETAIL, DISTRIBUTION, & SALES': ['Licensing (sales)', 'Point-of-Sale'],
    'PRODUCT & INNOVATION': ['Harm Reduction', 'New Product Launches'],
    LITIGATION: ['Class Actions', 'Trademark Disputes'],
    'MARKET & FINANCIAL': ['Mergers & Acquisitions', 'Earnings Reports'],
  }
  for (const [parentName, children] of Object.entries(tree)) {
    const parent = await payload.create({
      collection: 'subjects',
      data: { name: parentName },
      overrideAccess: true,
    })
    ids[parentName] = parent.id
    for (const childName of children) {
      const child = await payload.create({
        collection: 'subjects',
        data: { name: childName, parent: parent.id },
        overrideAccess: true,
      })
      ids[childName] = child.id
    }
  }
  return ids
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

export async function seedExcerptContent(payload: Payload) {
  console.log('Seeding taxonomies (sectors, products, subjects, locations, sources)...')
  const locationIds = await seedLocations(payload)
  const sectorIds = await seedFlatTaxonomy(payload, 'sectors', [
    { name: 'Manufacturers' },
    { name: 'Retail & Distribution' },
    { name: 'Social' },
    { name: 'Public Health' },
    { name: 'Government/Regulatory' },
    { name: 'Investors' },
  ])
  const productIds = await seedFlatTaxonomy(payload, 'products', [
    { name: 'All Products' },
    { name: 'Cigarettes' },
    { name: 'Vapor/E-liquid' },
    { name: 'Smokeless/Oral Nicotine' },
    { name: 'Heated Tobacco' },
    { name: 'Cigars' },
  ])
  const subjectIds = await seedSubjects(payload)
  const sourceIds = await seedFlatTaxonomy(payload, 'sources', [
    { name: 'Tobacco Reporter', domain: 'tobaccoreporter.com' },
    { name: 'Vapor Voice', domain: 'vaporvoice.net' },
    { name: 'Convenience Store News', domain: 'csnews.com' },
    { name: 'Reuters', domain: 'reuters.com' },
    { name: 'The Kenya Times', domain: 'thekenyatimes.com' },
    { name: 'BusinessDay', domain: 'businessday.ng' },
    { name: 'Nikkei Asia', domain: 'asia.nikkei.com' },
    { name: 'Politico', domain: 'politico.com' },
    { name: 'Law360', domain: 'law360.com' },
    { name: 'STAT News', domain: 'statnews.com' },
  ])

  const locationNames = Object.keys(locationIds)
  const sectorNames = Object.keys(sectorIds)
  const productNames = Object.keys(productIds)
  const subjectLeafNames = [
    'Flavor Bans',
    'Taxation',
    'Age Verification',
    'Licensing (sales)',
    'Point-of-Sale',
    'Harm Reduction',
    'New Product Launches',
    'Class Actions',
    'Trademark Disputes',
    'Mergers & Acquisitions',
    'Earnings Reports',
  ]
  const sourceNames = Object.keys(sourceIds)

  function indexTermsFor(i: number) {
    return {
      locations: [locationIds[pick(locationNames, i)], locationIds[pick(locationNames, i + 3)]],
      sectors: [sectorIds[pick(sectorNames, i)]],
      products: [productIds[pick(productNames, i)]],
      primarySubject: subjectIds[pick(subjectLeafNames, i)],
      subjects: [subjectIds[pick(subjectLeafNames, i)], subjectIds[pick(subjectLeafNames, i + 4)]],
    }
  }

  console.log('Seeding articles...')
  const articleTitles = [
    'FDA Proposes New Menthol Cigarette Ban Timeline',
    'Altria Reports Q3 Earnings Beat on Vapor Segment Growth',
    'Kenya Moves to Regulate E-Cigarette Imports',
    'California Court Upholds Flavored Tobacco Sales Ban',
    'Philip Morris International Expands IQOS to New Markets',
    'UK Considers Generational Smoking Ban Legislation',
    'British American Tobacco Faces Shareholder Pressure Over ESG',
    'Vapor Industry Trade Group Challenges FDA Authorization Delays',
    'India Tightens Rules on Smokeless Tobacco Packaging',
    'Juul Labs Settles Multi-State Litigation Over Youth Marketing',
    'Germany Raises Excise Tax on Heated Tobacco Products',
    'Convenience Stores Report Decline in Cigarette Unit Sales',
    'South Africa Debates Plain Packaging Requirements',
    "China's Tobacco Monopoly Posts Record Annual Revenue",
    'New York City Expands Flavor Ban to Include Vapor Products',
    'Public Health Groups Push for Nicotine Cap Regulation',
    'Imperial Brands Announces New Reduced-Risk Product Line',
    'Pennsylvania Lawmakers Debate Vape Tax Increase',
    'Swisher International Launches New Cigar Packaging',
    'Retailers Warn of Compliance Burden from Age Verification Rules',
    'Reuters: Global Cigarette Volumes Continue Secular Decline',
    'Canada Proposes Nicotine Content Limits for Vaping Products',
    'Analysts Upgrade Altria Following Vapor Segment Pivot',
    'Trademark Dispute Erupts Over Vapor Brand Packaging Design',
    'Investors Eye Tobacco Sector Amid Harm Reduction Pivot',
  ]
  for (const [i, title] of articleTitles.entries()) {
    const sourceDate = new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString()
    await payload.create({
      collection: 'articles',
      data: {
        title,
        source: sourceIds[pick(sourceNames, i)],
        sourceUrl: `https://${pick(sourceNames, i)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '')}.example/${i}`,
        sourceDate,
        excerpt: lexicalFromText(
          `${title}. Placeholder excerpt summarizing the coverage for seed/demo purposes, including key figures, quoted officials, and industry reaction.`,
        ),
        ...indexTermsFor(i),
        _status: 'published',
      },
      overrideAccess: true,
    })
  }

  console.log('Seeding bills...')
  const billSeed: Array<{
    billNumber: string
    title: string
    location: string
    govLevel: 'Federal' | 'State/Province' | 'Local' | 'International'
  }> = [
    { billNumber: 'H.1434', title: 'An Act Relative to Flavored Tobacco Products', location: 'Pennsylvania', govLevel: 'State/Province' },
    { billNumber: 'S.220', title: 'Vapor Product Tax Act', location: 'California', govLevel: 'State/Province' },
    { billNumber: 'H.R.3312', title: 'Tobacco Product Youth Protection Act', location: 'United States', govLevel: 'Federal' },
    { billNumber: 'A.B.987', title: 'Smoke-Free Workplace Expansion Act', location: 'New York', govLevel: 'State/Province' },
    { billNumber: 'S.B.410', title: 'E-Cigarette Licensing Act', location: 'California', govLevel: 'State/Province' },
    { billNumber: 'H.2201', title: 'Menthol Cigarette Restriction Act', location: 'Pennsylvania', govLevel: 'State/Province' },
    { billNumber: 'C-45', title: 'Vaping Products Labelling Act', location: 'Canada', govLevel: 'Federal' },
    { billNumber: 'H.R.5120', title: 'PACT Act Modernization Act', location: 'United States', govLevel: 'Federal' },
    { billNumber: 'S.330', title: 'Tobacco Retailer Licensing Reform', location: 'New York', govLevel: 'State/Province' },
    { billNumber: 'H.1890', title: 'Heated Tobacco Tax Parity Act', location: 'Pennsylvania', govLevel: 'State/Province' },
    { billNumber: 'A.B.512', title: 'Flavored Nicotine Pouch Restriction Act', location: 'California', govLevel: 'State/Province' },
    { billNumber: 'H.R.2290', title: 'Synthetic Nicotine Regulation Act', location: 'United States', govLevel: 'Federal' },
    { billNumber: 'S.B.77', title: 'Youth Vaping Prevention Act', location: 'New York', govLevel: 'State/Province' },
    { billNumber: 'H.3399', title: 'Tobacco Retail Density Limitation Act', location: 'Pennsylvania', govLevel: 'State/Province' },
    { billNumber: 'Bill 56', title: 'National Smoke-Free Generation Act', location: 'United Kingdom', govLevel: 'International' },
  ]
  const { docs: allArticles } = await payload.find({ collection: 'articles', limit: 200, overrideAccess: true })

  for (const [i, b] of billSeed.entries()) {
    const billDate = new Date(Date.now() - (i + 1) * 5 * 24 * 60 * 60 * 1000).toISOString()
    const terms = indexTermsFor(i + 2)
    await payload.create({
      collection: 'bills',
      data: {
        billType: pick(['Bill', 'Resolution', 'Amendment', 'Regulation'], i),
        billNumber: b.billNumber,
        title: b.title,
        locations: [locationIds[b.location]],
        session: 'Regular',
        governmentLevel: b.govLevel,
        billDate,
        abstract: lexicalFromText(`${b.title} (${b.billNumber}): placeholder abstract summarizing intent and scope.`),
        fullText: lexicalFromText(
          `${b.title}. Placeholder full bill text for seed/demo purposes. Section 1: Findings. Section 2: Definitions. Section 3: Requirements.`,
        ),
        sectors: terms.sectors,
        products: terms.products,
        primarySubject: terms.primarySubject,
        subjects: terms.subjects,
        relatedArticles: allArticles.length ? [pick(allArticles, i).id] : [],
        statusText: 'Proposed Rule',
        actions: [
          { date: billDate, action: 'Introduced by', actor: pick(['Gomez (D)', 'Whitfield (R)', 'Okafor (D)', 'Vance (R)'], i) },
          {
            date: new Date(new Date(billDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            action: 'Referred to committee',
            actor: 'Committee on Public Health',
          },
        ],
        _status: 'published',
      },
      overrideAccess: true,
    })
  }

  console.log('Seeding a placeholder trademark filing image...')
  const tmpImagePath = path.join(os.tmpdir(), 'nic360-trademark-placeholder.png')
  fs.writeFileSync(tmpImagePath, Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'))
  const placeholderImage = await payload.create({
    collection: 'media',
    data: { alt: 'Placeholder trademark filing image' },
    filePath: tmpImagePath,
    overrideAccess: true,
  })
  fs.unlinkSync(tmpImagePath)

  console.log('Seeding trademarks...')
  const trademarkSeed = [
    'VaporCrest',
    'CloudNine Vapes',
    'PureLeaf Tobacco',
    'NicoShift',
    'EmberRow Cigars',
    'SilverLeaf Menthol',
    'HeatWave Tobacco',
    'PouchPoint Nicotine',
    'DriftSmoke',
    'CrownLeaf Reserve',
  ]
  const owners = [
    'Altria Group',
    'Philip Morris International',
    'British American Tobacco',
    'Imperial Brands',
    'Juul Labs',
    'Swisher International',
  ]
  for (const [i, title] of trademarkSeed.entries()) {
    const publishedDate = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString()
    await payload.create({
      collection: 'trademarks',
      data: {
        title,
        serialNumber: `88${(100000 + i * 137).toString().padStart(6, '0')}`,
        class: '34',
        owner: pick(owners, i),
        ownerAddress: `${100 + i} Industry Pkwy, Richmond, VA`,
        style: pick(['yes', 'no', 'na'] as const, i),
        design: pick(['yes', 'no', 'na'] as const, i + 1),
        publishedDate,
        filedDate: new Date(new Date(publishedDate).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        image: placeholderImage.id,
        _status: 'published',
      },
      overrideAccess: true,
    })
  }

  console.log(
    `Seeded ${articleTitles.length} articles, ${billSeed.length} bills, ${trademarkSeed.length} trademarks (${
      articleTitles.length + billSeed.length + trademarkSeed.length
    } excerpts total).`,
  )
}
