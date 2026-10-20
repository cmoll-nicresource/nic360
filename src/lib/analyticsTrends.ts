import type { Payload, PayloadRequest } from 'payload'
import { staffHasRole } from '@/access/staffRoles'
import { sectionForPath, type SectionKey } from './pageSections'
import type { HistoryEntry } from './analytics'
import type { PublicationIssueStatsRow } from './publicationAnalytics'

export type AnalyticsRange = { from: string; to: string; grain: 'day' | 'week' | 'month' }
export type TrendPoint = { date: string; values: (number | null)[] }
const DAY = 86400000
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

export function analyticsRange(from?: string, to?: string, grain?: string, now = new Date()): AnalyticsRange {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const end = to || today
  if (!validDate(end)) throw new Error('Choose a valid end date.')
  const start = from || new Date(Date.parse(end) - 29 * DAY).toISOString().slice(0, 10)
  if (!validDate(start) || !validDate(end) || start > end || (Date.parse(end) - Date.parse(start)) / DAY > 365)
    throw new Error('Choose valid dates in order, covering no more than 366 days.')
  const days = (Date.parse(end) - Date.parse(start)) / DAY + 1
  return { from: start, to: end, grain: grain === 'day' || grain === 'week' || grain === 'month' ? grain : days <= 45 ? 'day' : days <= 180 ? 'week' : 'month' }
}

export function bucketDate(date: string, grain: AnalyticsRange['grain']) {
  const value = new Date(date.slice(0, 10) + 'T00:00:00Z')
  if (grain === 'month') value.setUTCDate(1)
  if (grain === 'week') value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7)
  return value.toISOString().slice(0, 10)
}

export function fillTrend(range: AnalyticsRange, rows: { date: string; values: (number | null)[] }[], dimensions = 2): TrendPoint[] {
  const byDate = new Map(rows.map(row => [row.date, row.values]))
  const dates = new Set<string>()
  for (let time = Date.parse(range.from); time <= Date.parse(range.to); time += DAY) dates.add(bucketDate(new Date(time).toISOString(), range.grain))
  return [...dates].map(date => ({ date, values: byDate.get(date) ?? Array.from({ length: dimensions }, () => 0) }))
}

function authorize(user: PayloadRequest['user']) {
  if (!staffHasRole(user, 'gatekeeper')) throw new Error('Gatekeeper access required.')
}

export async function getTrafficTrends(payload: Payload, user: PayloadRequest['user'], input: AnalyticsRange, filter: { userId?: number; path?: string; section?: SectionKey } = {}) {
  authorize(user)
  const range = analyticsRange(input.from, input.to, input.grain)
  if (filter.userId !== undefined && (!Number.isSafeInteger(filter.userId) || filter.userId < 1)) throw new Error('Invalid user')
  const params: unknown[] = [range.from, range.to, range.grain]
  let where = `v.created_at >= ($1::date::timestamp AT TIME ZONE 'America/New_York') AND v.created_at < (($2::date + 1)::timestamp AT TIME ZONE 'America/New_York')`
  for (const [column, value] of [['v.visitor_id', filter.userId], ['v.path', filter.path]] as const) if (value !== undefined) { params.push(value); where += ` AND ${column}=$${params.length}` }
  // One aggregate per distinct path avoids loading visits; section classification stays shared with navigation.
  const pathResult = await payload.db.pool.query<{ path: string; count: number }>(`SELECT v.path,count(*)::int AS count FROM public.page_views v WHERE ${where} AND $3::text IS NOT NULL GROUP BY v.path`, params)
  const selectedPaths = filter.section ? pathResult.rows.filter(row => sectionForPath(row.path) === filter.section).map(row => row.path) : null
  if (selectedPaths) { params.push(selectedPaths); where += ` AND v.path=ANY($${params.length}::text[])` }
  const [trend, summary, topUsers, history] = await Promise.all([
    payload.db.pool.query<{ date: string; views: number; visitors: number }>(`SELECT to_char(date_trunc($3, v.created_at AT TIME ZONE 'America/New_York'),'YYYY-MM-DD') AS date,count(*)::int AS views,count(DISTINCT v.visitor_id)::int AS visitors FROM public.page_views v WHERE ${where} GROUP BY 1 ORDER BY 1`, params),
    payload.db.pool.query<{ views: number; visitors: number }>(`SELECT count(*)::int AS views,count(DISTINCT v.visitor_id)::int AS visitors FROM public.page_views v WHERE ${where} AND $3::text IS NOT NULL`, params),
    payload.db.pool.query<{ id: number; email: string; first_name: string; last_name: string; count: number }>(`SELECT u.id,u.email,u.first_name,u.last_name,count(*)::int AS count FROM public.page_views v JOIN public.users u ON u.id=v.visitor_id WHERE ${where} AND $3::text IS NOT NULL GROUP BY u.id ORDER BY count(*) DESC,u.id LIMIT 15`, params),
    Object.keys(filter).length ? payload.db.pool.query<{ id: number; path: string; created_at: Date; visitor_id: number | null; email: string; first_name: string; last_name: string }>(`SELECT v.id,v.path,v.created_at,v.visitor_id,u.email,u.first_name,u.last_name FROM public.page_views v LEFT JOIN public.users u ON u.id=v.visitor_id WHERE ${where} AND $3::text IS NOT NULL ORDER BY v.created_at DESC,v.id DESC LIMIT 1000`, params) : Promise.resolve({ rows: [] }),
  ])
  const paths = pathResult.rows.filter(row => !filter.section || sectionForPath(row.path) === filter.section).sort((a,b) => b.count-a.count || a.path.localeCompare(b.path))
  const sections = new Map<SectionKey, number>()
  for (const row of paths) { const key = sectionForPath(row.path); sections.set(key, (sections.get(key) ?? 0) + row.count) }
  return {
    ...summary.rows[0], points: fillTrend(range, trend.rows.map(row => ({ date: row.date, values: [row.views, row.visitors] }))),
    paths: paths.slice(0,15), sections: [...sections].map(([key,count]) => ({key,count})).sort((a,b) => b.count-a.count),
    users: topUsers.rows.map(row => ({ visitor: {id:row.id,email:row.email,firstName:row.first_name,lastName:row.last_name}, count:row.count })),
    history: history.rows.map(row => ({ id:row.id,path:row.path,createdAt:row.created_at.toISOString(),visitor:row.visitor_id && row.email ? {id:row.visitor_id,email:row.email,firstName:row.first_name,lastName:row.last_name} : null })) as HistoryEntry[],
  }
}

export async function getRegistrationTrends(payload: Payload, user: PayloadRequest['user'], input: AnalyticsRange, eventId?: number) {
  authorize(user)
  const range=analyticsRange(input.from,input.to,input.grain)
  if(eventId !== undefined && (!Number.isSafeInteger(eventId)||eventId<1)) throw new Error('Invalid event')
  const result=await payload.db.pool.query<{date:string; in_person:number; virtual:number}>(`SELECT to_char(date_trunc($3,created_at AT TIME ZONE 'America/New_York'),'YYYY-MM-DD') AS date,count(*) FILTER(WHERE attendance='in-person')::int AS in_person,count(*) FILTER(WHERE attendance='virtual')::int AS virtual FROM public.event_registrations WHERE status='active' AND created_at >= ($1::date::timestamp AT TIME ZONE 'America/New_York') AND created_at < (($2::date+1)::timestamp AT TIME ZONE 'America/New_York') AND ($4::int IS NULL OR event_id=$4) GROUP BY 1 ORDER BY 1`,[range.from,range.to,range.grain,eventId??null])
  return fillTrend(range,result.rows.map(row=>({date:row.date,values:[row.in_person,row.virtual]})))
}

export function publicationTrends(rows: PublicationIssueStatsRow[], range: AnalyticsRange) {
  const grouped=new Map<string,number[]>()
  for(const row of rows){const date=new Date(row.issueDate).toISOString().slice(0,10);if(date<range.from||date>range.to)continue;const key=bucketDate(date,range.grain);const values=grouped.get(key)??[0,0,0];values[0]+=row.recipientCount;values[1]+=row.opens;values[2]+=row.clicks;grouped.set(key,values)}
  const counts=fillTrend(range,[...grouped].map(([date,values])=>({date,values})),3)
  return {counts,rates:counts.map(point=>({date:point.date,values:point.values[0] ? [100*point.values[1]!/point.values[0],100*point.values[2]!/point.values[0]] : [null,null]}))}
}
