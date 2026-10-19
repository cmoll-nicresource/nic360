import type { Payload } from 'payload'
import catalog from '@/config/researchJournals.json'
/** Idempotent catalog bootstrap; preserve existing journal records and publication preferences/IDs. */
export async function setupResearch(payload: Payload) {
  const existing = await payload.find({
    collection: 'journals',
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const names = new Set(existing.docs.map((j) => j.name.toLowerCase()))
  let created = 0
  for (const journal of catalog)
    if (!names.has(journal.name.toLowerCase())) {
      await payload.create({
        collection: 'journals',
        data: journal,
        overrideAccess: true,
      })
      names.add(journal.name.toLowerCase())
      created++
    }
  const pubs = await payload.find({
    collection: 'publications',
    where: { slug: { equals: 'monthly-research-digest' } },
    limit: 1,
    overrideAccess: true,
  })
  const data = {
    title: 'Monthly Research Digest',
    slug: 'monthly-research-digest',
    description:
      'Research articles and abstracts grouped by journal, with authors, dates and DOI links.',
    category: ['research' as const],
    format: 'pdf-report' as const,
    frequency: 'monthly' as const,
    generator: 'monthly-research-digest' as const,
  }
  const publication = pubs.docs[0]
  if (!publication)
    await payload.create({
      collection: 'publications',
      data,
      overrideAccess: true,
    })
  else if (
    publication.format !== data.format ||
    publication.generator !== data.generator ||
    !publication.category?.includes('research')
  )
    await payload.update({
      collection: 'publications',
      id: publication.id,
      data: {
        description: data.description,
        category: data.category,
        format: data.format,
        frequency: data.frequency,
        generator: data.generator,
      },
      overrideAccess: true,
    })
  return { journalsCreated: created, journalCount: names.size }
}
