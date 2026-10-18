import type { CollectionAfterOperationHook, Where } from 'payload'
import { staffHasRole } from '@/access/staffRoles'

/** Partition native pages without losing users with no login or breaking page boundaries. */
export function loginOrderPages(datedCount: number, page: number, limit: number) {
  const offset = (page - 1) * limit
  const datedTake = Math.min(limit, Math.max(0, datedCount - offset))
  const segments: { dated: boolean; page: number; skip: number; take: number }[] = []
  if (datedTake) segments.push({ dated: true, page, skip: 0, take: datedTake })
  let remaining = limit - datedTake
  let undatedOffset = Math.max(0, offset - datedCount)
  while (remaining > 0) {
    const skip = undatedOffset % limit
    const take = Math.min(remaining, limit - skip)
    segments.push({ dated: false, page: Math.floor(undatedOffset / limit) + 1, skip, take })
    remaining -= take
    undatedOffset += take
  }
  return segments
}

/** Payload's Postgres adapter sorts DESC with NULLs first. Keep native access, filters and metadata. */
export const sortUsersByLogin: CollectionAfterOperationHook<'users'> = async ({ operation, args, result }) => {
  if (operation !== 'find' || !args.req || args.req.context.loginOrderPartition || !staffHasRole(args.req.user, 'gatekeeper')) return result
  const sort = args.sort ?? args.collection.config.defaultSort
  if (sort !== '-lastLoginAt' || !result.docs.length) return result
  const req = { ...args.req, context: { ...args.req.context, loginOrderPartition: true } }
  const { collection: _collection, req: _req, ...options } = args
  const where = (dated: boolean): Where => ({ and: [args.where || {}, { lastLoginAt: { exists: dated } }] })
  const find = (dated: boolean, page: number, limit: number) => req.payload.find({
    ...options, collection: 'users', req, overrideAccess: args.overrideAccess ?? false,
    where: where(dated), sort: dated ? '-lastLoginAt' : '-createdAt', page, limit,
  })
  if (args.pagination === false || args.limit === 0) {
    const [dated, undated] = await Promise.all([find(true, 1, 0), find(false, 1, 0)])
    return { ...result, docs: [...dated.docs, ...undated.docs] }
  }
  const { totalDocs: datedCount } = await req.payload.count({ collection: 'users', req, overrideAccess: args.overrideAccess ?? false, where: where(true) })
  if (datedCount === 0 || datedCount === result.totalDocs) return result
  const segments = loginOrderPages(datedCount, result.page ?? 1, result.limit)
  const pages = await Promise.all(segments.map(segment => find(segment.dated, segment.page, result.limit)))
  return { ...result, docs: pages.flatMap((page, index) => page.docs.slice(segments[index].skip, segments[index].skip + segments[index].take)) }
}
