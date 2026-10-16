import type { Payload } from 'payload'
import { publicationSelectionRules } from './publicationSelectionPolicy'

export async function repairPublicationSelectionRules(payload: Payload, apply = false) {
  const countries = await payload.find({
    collection: 'locations',
    where: { and: [{ name: { equals: 'United States' } }, { level: { equals: 'country' } }] },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (countries.docs.length !== 1)
    throw new Error('A unique United States country location is required.')
  const changes = []
  let page = 1,
    more = true
  while (more) {
    const result = await payload.find({
      collection: 'publications',
      where: { format: { equals: 'excerpt-list' } },
      limit: 100,
      page,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    for (const publication of result.docs) {
      const after = publicationSelectionRules(publication, countries.docs[0].id)
      if (JSON.stringify(after) === JSON.stringify(publication.selectionRules ?? {})) continue
      changes.push({
        id: publication.id,
        title: publication.title,
        before: publication.selectionRules,
        after,
      })
      if (apply)
        await payload.update({
          collection: 'publications',
          id: publication.id,
          data: { selectionRules: after },
          overrideAccess: true,
        })
    }
    more = result.hasNextPage
    page++
  }
  return { apply, changes }
}
