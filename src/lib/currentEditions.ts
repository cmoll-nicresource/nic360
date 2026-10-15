import { cache } from 'react'
import { frontendContext } from './frontendContext'

/** One published edition per title. A busy daily must not hide a monthly report. */
export const currentEditions = cache(async () => {
  const { payload, user, canRead } = await frontendContext()
  if (!canRead) return { publications: [], issues: [] }
  const publications = await payload.find({
    collection: 'publications',
    limit: 100,
    sort: 'title',
    depth: 1,
    user,
    overrideAccess: false,
  })
  const results = await Promise.all(
    publications.docs.map((publication) =>
      payload.find({
        collection: 'publication-issues',
        where: {
          and: [{ publication: { equals: publication.id } }, { _status: { equals: 'published' } }],
        },
        sort: '-issueDate',
        limit: 1,
        depth: 1,
        user,
        overrideAccess: false,
      }),
    ),
  )
  return {
    publications: publications.docs,
    issues: results
      .flatMap((result) => result.docs)
      .sort((a, b) => Date.parse(b.issueDate) - Date.parse(a.issueDate)),
  }
})
