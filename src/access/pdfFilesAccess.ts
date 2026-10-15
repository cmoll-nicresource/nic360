import type { Access } from 'payload'
import { staffHasRole } from './staffRoles'
import { getReaderPlan } from './readerPlan'

/** A file inherits access from a published parent; unlinked/draft files are staff-only. */
export const canReadPdfFile: Access = async ({ req }) => {
  if (staffHasRole(req.user, 'editor')) return true
  if (req.user?.collection !== 'users') return false
  const plan = await getReaderPlan(req.user, req.payload)
  if (plan === 'none') return false
  const ids = new Set<number>()
  async function collect(collection: 'guides' | 'publication-issues') {
    let page = 1
    for (;;) {
      const result = await req.payload.find({
        collection,
        depth: 0,
        limit: 250,
        page,
        overrideAccess: true,
        req,
        where: {
          and: [
            { _status: { equals: 'published' } },
            { file: { exists: true } },
            ...(collection === 'guides' && plan === 'base'
              ? [{ requiresPremium: { equals: false } }]
              : []),
          ],
        },
        select: { file: true },
      })
      for (const parent of result.docs) {
        const file = parent.file
        if (typeof file === 'number') ids.add(file)
        else if (file && typeof file === 'object') ids.add(file.id)
      }
      if (!result.hasNextPage) break
      page++
    }
  }
  await Promise.all([collect('guides'), collect('publication-issues')])
  return ids.size ? { id: { in: [...ids] } } : false
}
