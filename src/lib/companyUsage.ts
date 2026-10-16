import Papa from 'papaparse'
import type { Payload, PayloadRequest } from 'payload'
import { staffHasRole } from '@/access/staffRoles'
import { sectionForPath, sectionLabel } from './pageSections'

export class CompanyReportInputError extends Error {}
export function companyReportInput(provider: string, from: string, to: string) {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1 &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  if (!/^[1-9]\d*$/.test(provider) || !Number.isSafeInteger(Number(provider)))
    throw new CompanyReportInputError('Choose a company / access provider.')
  if (!validDate(from) || !validDate(to))
    throw new CompanyReportInputError('Enter valid start and end dates.')
  if (from > to)
    throw new CompanyReportInputError('The end date must be on or after the start date.')
  return { providerId: Number(provider), from, to }
}

export const COMPANY_USAGE_SQL = `WITH views AS (
  SELECT p.visitor_id, p.path, p.created_at
  FROM page_views p JOIN users u ON u.id=p.visitor_id
  WHERE u.access_provider_id=$1
    AND p.created_at >= ($2::date::timestamp AT TIME ZONE 'America/New_York')
    AND p.created_at < (($3::date + 1)::timestamp AT TIME ZONE 'America/New_York')
), totals AS (
  SELECT visitor_id, count(*)::integer AS views,
    count(DISTINCT path)::integer AS pages,
    count(DISTINCT (created_at AT TIME ZONE 'America/New_York')::date)::integer AS days,
    min(created_at) AS first_view, max(created_at) AS last_view
  FROM views GROUP BY visitor_id
), paths AS (
  SELECT visitor_id, path, count(*)::integer AS count FROM views GROUP BY visitor_id, path
), breakdown AS (
  SELECT visitor_id, jsonb_agg(jsonb_build_object('path', path, 'count', count)
    ORDER BY count DESC, path) AS paths FROM paths GROUP BY visitor_id
)
SELECT u.id, u.email, u.first_name, u.last_name, u.status,
  coalesce(t.views,0) AS views, coalesce(t.pages,0) AS pages, coalesce(t.days,0) AS days,
  t.first_view, t.last_view, coalesce(b.paths,'[]'::jsonb) AS paths
FROM users u LEFT JOIN totals t ON t.visitor_id=u.id
LEFT JOIN breakdown b ON b.visitor_id=u.id
WHERE u.access_provider_id=$1
ORDER BY coalesce(t.views,0) DESC, lower(u.email), u.id`

type UsageRecord = {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  status: string
  views: number
  pages: number
  days: number
  first_view: Date | string | null
  last_view: Date | string | null
  paths: { path: string; count: number }[]
}
export function usageRow(row: UsageRecord) {
  const counts = new Map<string, number>()
  for (const item of row.paths) {
    const label = sectionLabel(sectionForPath(item.path))
    counts.set(label, (counts.get(label) ?? 0) + item.count)
  }
  const sections = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const stamp = (value: Date | string | null) => (value ? new Date(value).toISOString() : null)
  return {
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    email: row.email,
    status: row.status,
    views: row.views,
    pages: row.pages,
    days: row.days,
    firstView: stamp(row.first_view),
    lastView: stamp(row.last_view),
    sections,
    topPages: row.paths.slice(0, 5),
  }
}
export async function getCompanyUsage(
  payload: Payload,
  user: PayloadRequest['user'],
  input: ReturnType<typeof companyReportInput>,
) {
  if (!staffHasRole(user, 'gatekeeper'))
    throw new Response('Staff access required.', { status: 403 })
  // Validate again at the data boundary; no unchecked IDs or dates reach Postgres.
  const { providerId, from, to } = companyReportInput(
    String(input.providerId),
    input.from,
    input.to,
  )
  const provider = await payload.findByID({
    collection: 'access-providers',
    id: providerId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
  if (!provider) throw new CompanyReportInputError('That company / access provider was not found.')
  const result = await payload.db.pool.query<UsageRecord>(COMPANY_USAGE_SQL, [providerId, from, to])
  const rows = result.rows.map(usageRow)
  return {
    provider: { id: provider.id, name: provider.name },
    from,
    to,
    rows,
    totals: {
      users: rows.length,
      active: rows.filter((r) => r.views > 0).length,
      views: rows.reduce((sum, r) => sum + r.views, 0),
    },
  }
}
export type CompanyUsageReport = Awaited<ReturnType<typeof getCompanyUsage>>
const easternStamp = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : ''
export function companyUsageCsv(report: CompanyUsageReport) {
  return Papa.unparse(
    {
      fields: [
        'Company',
        'Start date (ET)',
        'End date (ET)',
        'Name',
        'Email',
        'Account status',
        'Page views',
        'Active days (ET)',
        'Distinct pages',
        'First activity (ET)',
        'Last activity (ET)',
        'Sections',
        'Top pages',
      ],
      data: report.rows.map((r) => [
        report.provider.name,
        report.from,
        report.to,
        r.name,
        r.email,
        r.status,
        r.views,
        r.days,
        r.pages,
        easternStamp(r.firstView),
        easternStamp(r.lastView),
        r.sections.map(([label, count]) => `${label}: ${count}`).join('; '),
        r.topPages.map((p) => `${p.path}: ${p.count}`).join('; '),
      ]),
    },
    { escapeFormulae: true },
  )
}
