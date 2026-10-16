import type { Payload, Where } from 'payload'

import type { Article, Bill, Location, Publication, Trademark } from '@/payload-types'
import { publicationGeography, publicationSelectionRules } from './publicationSelectionPolicy'
import { publicationDateWindow } from './publicationDateWindow'

type ExcerptType = 'articles' | 'bills' | 'trademarks'
type ExcerptDoc = (Article | Bill | Trademark) & { collection: ExcerptType }

const DATE_FIELD: Record<ExcerptType, string> = {
  articles: 'sourceDate',
  bills: 'billDate',
  trademarks: 'publishedDate',
}

const DEFAULT_WINDOW_DAYS: Record<Publication['frequency'], number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
}

function idOf(ref: number | { id: number } | null | undefined): number | undefined {
  if (ref == null) return undefined
  return typeof ref === 'object' ? ref.id : ref
}

/** Expands a set of location ids to include every descendant, so a rule for
 * "United States" also matches items tagged with "Pennsylvania". */
function expandLocationDescendants(allLocations: Location[], rootIds: number[]): number[] {
  if (rootIds.length === 0) return []
  const childrenByParent = new Map<number, number[]>()
  for (const loc of allLocations) {
    const parentId = idOf(loc.parent)
    if (parentId) {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
      childrenByParent.get(parentId)!.push(loc.id)
    }
  }
  const result = new Set<number>()
  const stack = [...rootIds]
  while (stack.length) {
    const id = stack.pop()!
    if (result.has(id)) continue
    result.add(id)
    for (const child of childrenByParent.get(id) ?? []) stack.push(child)
  }
  return [...result]
}

async function buildWhereForType(
  allLocations: Location[],
  type: ExcerptType,
  since: string,
  until: string,
  rules: NonNullable<Publication['selectionRules']>,
  foreignIds?: number[],
): Promise<Where> {
  const and: Where[] = [
    { _status: { equals: 'published' } },
    { [DATE_FIELD[type]]: { greater_than_equal: since, less_than: until } },
  ]

  if (type === 'trademarks') return { and } // Trademarks carry no index terms.

  for (const dim of ['sectors', 'products', 'subjects'] as const) {
    const rule = rules[dim]
    const includeIds = (rule?.include ?? []).map(idOf).filter((v): v is number => v != null)
    const excludeIds = (rule?.exclude ?? []).map(idOf).filter((v): v is number => v != null)
    if (includeIds.length) and.push({ [dim]: { in: includeIds } })
    if (excludeIds.length) and.push({ [dim]: { not_in: excludeIds } })
  }

  const locRule = rules.locations
  const includeIds = (locRule?.include ?? []).map(idOf).filter((v): v is number => v != null)
  const excludeIds = (locRule?.exclude ?? []).map(idOf).filter((v): v is number => v != null)
  if (includeIds.length) {
    and.push({ locations: { in: expandLocationDescendants(allLocations, includeIds) } })
  }
  if (excludeIds.length) {
    // Global Clippings uses a positive non-US match below. A blanket NOT US
    // would incorrectly reject a story tagged both United States and China.
    const excluded = expandLocationDescendants(allLocations, excludeIds)
    const strictExcluded = foreignIds ? excluded.filter((id) => foreignIds.includes(id)) : excluded
    if (strictExcluded.length) and.push({ locations: { not_in: strictExcluded } })
  }

  if (foreignIds) {
    if (!foreignIds.length)
      throw new Error('No non-US locations are configured for Global News Clippings.')
    and.push({ locations: { in: foreignIds } })
  }

  return { and }
}

async function fetchSelectedItems(
  payload: Payload,
  publication: Publication,
  allLocations: Location[],
  issueDate: string,
  foreignIds?: number[],
): Promise<ExcerptDoc[]> {
  const us = allLocations.filter(
    (l) => l.level === 'country' && l.name.trim().toLowerCase() === 'united states',
  )
  const rules = publicationSelectionRules(publication, us.length === 1 ? us[0].id : undefined)
  const windowDays = rules.window ?? DEFAULT_WINDOW_DAYS[publication.frequency]
  const { since, until } = publicationDateWindow(issueDate, windowDays)
  const types = (rules.excerptTypes?.length ? rules.excerptTypes : ['articles']) as ExcerptType[]

  const results: ExcerptDoc[] = []
  for (const type of types) {
    const where = await buildWhereForType(allLocations, type, since, until, rules, foreignIds)
    let page = 1,
      more = true
    while (more) {
      const result = await payload.find({
        collection: type,
        where,
        depth: 1,
        limit: 500,
        page,
        sort: 'id',
        draft: false,
        overrideAccess: true,
      })
      for (const doc of result.docs) {
        results.push({ ...doc, collection: type } as ExcerptDoc)
      }
      more = result.hasNextPage
      page++
    }
  }
  return results
}

function itemDate(item: ExcerptDoc): string | null {
  const field = DATE_FIELD[item.collection]
  const value = (item as unknown as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : null
}

function findAncestorAtLevel(
  location: Location,
  level: Location['level'],
  byId: Map<number, Location>,
): Location | undefined {
  let current: Location | undefined = location
  const seen = new Set<number>()
  while (current && !seen.has(current.id)) {
    if (current.level === level) return current
    seen.add(current.id)
    const parentId = idOf(current.parent)
    current = parentId ? byId.get(parentId) : undefined
  }
  return undefined
}

async function groupKeyFor(
  payload: Payload,
  item: ExcerptDoc,
  groupBy: NonNullable<Publication['groupingRules']>['groupBy'],
  locationsById: Map<number, Location>,
): Promise<string> {
  switch (groupBy) {
    case 'region':
    case 'country': {
      if (item.collection === 'trademarks') return 'Other'
      const locs = (item as Article | Bill).locations ?? []
      for (const locRef of locs) {
        const loc = typeof locRef === 'object' ? locRef : locationsById.get(locRef)
        if (!loc) continue
        const ancestor = findAncestorAtLevel(loc, groupBy, locationsById)
        if (ancestor) return ancestor.name
      }
      return 'Other'
    }
    case 'primarySubject': {
      if (item.collection === 'trademarks') return 'Other'
      const subj = (item as Article | Bill).primarySubject
      return subj && typeof subj === 'object' ? subj.name : 'Other'
    }
    case 'sector': {
      if (item.collection === 'trademarks') return 'Other'
      const sector = (item as Article | Bill).sectors?.[0]
      return sector && typeof sector === 'object' ? sector.name : 'Other'
    }
    case 'product': {
      if (item.collection === 'trademarks') return 'Other'
      const product = (item as Article | Bill).products?.[0]
      return product && typeof product === 'object' ? product.name : 'Other'
    }
    case 'excerptType':
      return item.collection[0].toUpperCase() + item.collection.slice(1)
    case 'none':
    default:
      return ''
  }
}

function sortItems(
  items: ExcerptDoc[],
  sortBy: NonNullable<Publication['groupingRules']>['sortBy'],
) {
  const sorted = [...items]
  if (sortBy === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title))
  } else {
    sorted.sort((a, b) => {
      const da = itemDate(a) ?? ''
      const db = itemDate(b) ?? ''
      return sortBy === 'sourceDateAsc' ? da.localeCompare(db) : db.localeCompare(da)
    })
  }
  return sorted
}

export type BuiltSection = {
  heading: string
  items: Array<{ relationTo: ExcerptType; value: number }>
}

/** The "Build from rules" step: runs a publication's selection rules over the
 * date window, groups and sorts the results, and returns `sections` ready to
 * assign onto an Issue. Editors can then remove, add or reorder items. */
export async function buildSectionsFromRules(
  payload: Payload,
  publication: Publication,
  issueDate = new Date().toISOString(),
): Promise<BuiltSection[]> {
  const grouping = publication.groupingRules ?? { groupBy: 'none', sortBy: 'sourceDateDesc' }

  const allLocations: Location[] = []
  let page = 1,
    more = true
  while (more) {
    const result = await payload.find({
      collection: 'locations',
      limit: 500,
      page,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    allLocations.push(...result.docs)
    more = result.hasNextPage
    page++
  }
  let foreignIds: number[] | undefined
  if (publicationGeography(publication) === 'non-us') {
    const us = allLocations.filter(
      (l) => l.level === 'country' && l.name.trim().toLowerCase() === 'united states',
    )
    if (us.length !== 1)
      throw new Error(
        'A unique United States country location is required to build Global News Clippings.',
      )
    const domestic = new Set(expandLocationDescendants(allLocations, [us[0].id]))
    foreignIds = allLocations.filter((l) => !domestic.has(l.id)).map((l) => l.id)
  }
  const items = await fetchSelectedItems(payload, publication, allLocations, issueDate, foreignIds)
  // For mixed US/non-US stories, group by the non-US location in Global.
  if (foreignIds)
    for (const item of items)
      if (item.collection !== 'trademarks') {
        const excerpt = item as Article | Bill
        excerpt.locations = (excerpt.locations ?? []).filter((ref) =>
          foreignIds!.includes(idOf(ref)!),
        )
      }
  const locationsById = new Map(allLocations.map((l) => [l.id, l]))

  const groups = new Map<string, ExcerptDoc[]>()
  for (const item of items) {
    const primary = await groupKeyFor(payload, item, grouping.groupBy ?? 'none', locationsById)
    const secondary = grouping.thenGroupBy
      ? await groupKeyFor(payload, item, grouping.thenGroupBy, locationsById)
      : ''
    const heading = [primary, secondary].filter(Boolean).join(': ') || 'All'
    if (!groups.has(heading)) groups.set(heading, [])
    groups.get(heading)!.push(item)
  }

  const sortBy = grouping.sortBy ?? 'sourceDateDesc'
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([heading, groupItems]) => ({
      heading,
      items: sortItems(groupItems, sortBy).map((item) => ({
        relationTo: item.collection,
        value: item.id,
      })),
    }))
}
