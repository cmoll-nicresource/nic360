import type { Payload } from 'payload'

import type { PageView, User } from '@/payload-types'
import { sectionForPath, type SectionKey } from './pageSections'

// Prototype-scale bound: enough to aggregate over meaningfully without
// pulling the whole table into memory on every dashboard request.
const RECENT_LIMIT = 10000

export type SimpleVisitor = { id: number; email: string; firstName?: string | null; lastName?: string | null }

export function visitorLabel(v: SimpleVisitor): string {
  const name = [v.firstName, v.lastName].filter(Boolean).join(' ')
  return name ? `${name} (${v.email})` : v.email
}

async function fetchRecentViews(payload: Payload, limit = RECENT_LIMIT): Promise<PageView[]> {
  const { docs } = await payload.find({
    collection: 'page-views',
    limit,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })
  return docs
}

export type OverviewStats = {
  totalViews: number
  recentViews: number // last 30 days
  uniqueVisitors: number // last 30 days, signed-in only
  topSections: { key: SectionKey; count: number }[]
  topPaths: { path: string; count: number }[]
  topUsers: { visitor: SimpleVisitor; count: number }[]
}

export async function getOverviewStats(payload: Payload): Promise<OverviewStats> {
  const views = await fetchRecentViews(payload)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recent = views.filter((v) => new Date(v.createdAt).getTime() >= thirtyDaysAgo)

  const sectionCounts = new Map<SectionKey, number>()
  const pathCounts = new Map<string, number>()
  const userCounts = new Map<number, { visitor: SimpleVisitor; count: number }>()
  const uniqueVisitorIds = new Set<number>()

  for (const v of recent) {
    const section = sectionForPath(v.path)
    sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1)
    pathCounts.set(v.path, (pathCounts.get(v.path) ?? 0) + 1)

    if (v.visitor && typeof v.visitor === 'object') {
      const u = v.visitor as User
      uniqueVisitorIds.add(u.id)
      const existing = userCounts.get(u.id)
      if (existing) {
        existing.count += 1
      } else {
        userCounts.set(u.id, { visitor: { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName }, count: 1 })
      }
    }
  }

  const topSections = [...sectionCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)

  const topPaths = [...pathCounts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const topUsers = [...userCounts.values()].sort((a, b) => b.count - a.count).slice(0, 15)

  return {
    totalViews: views.length,
    recentViews: recent.length,
    uniqueVisitors: uniqueVisitorIds.size,
    topSections,
    topPaths,
    topUsers,
  }
}

export type HistoryEntry = { id: number; path: string; createdAt: string; visitor: SimpleVisitor | null }

function toHistoryEntry(v: PageView): HistoryEntry {
  const visitor =
    v.visitor && typeof v.visitor === 'object'
      ? { id: v.visitor.id, email: v.visitor.email, firstName: v.visitor.firstName, lastName: v.visitor.lastName }
      : null
  return { id: v.id, path: v.path, createdAt: v.createdAt, visitor }
}

/** One reader's full page-view history, most recent first. */
export async function getUserHistory(payload: Payload, userId: number): Promise<HistoryEntry[]> {
  const { docs } = await payload.find({
    collection: 'page-views',
    where: { visitor: { equals: userId } },
    limit: 1000,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })
  return docs.map(toHistoryEntry)
}

/** Every visit to one exact path, most recent first. */
export async function getPageHistory(payload: Payload, path: string): Promise<HistoryEntry[]> {
  const { docs } = await payload.find({
    collection: 'page-views',
    where: { path: { equals: path } },
    limit: 1000,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })
  return docs.map(toHistoryEntry)
}

/** Every visit within a site section (e.g. all of Tracking), most recent first. */
export async function getSectionHistory(payload: Payload, section: SectionKey): Promise<HistoryEntry[]> {
  const views = await fetchRecentViews(payload)
  return views.filter((v) => sectionForPath(v.path) === section).map(toHistoryEntry)
}

/** Distinct paths that have at least one recorded view, sorted by view count. */
export async function getKnownPaths(payload: Payload): Promise<{ path: string; count: number }[]> {
  const views = await fetchRecentViews(payload)
  const counts = new Map<string, number>()
  for (const v of views) counts.set(v.path, (counts.get(v.path) ?? 0) + 1)
  return [...counts.entries()].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count)
}
