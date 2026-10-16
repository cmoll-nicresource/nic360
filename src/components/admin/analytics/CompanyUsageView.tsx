import Link from 'next/link'
import type { Payload, PayloadRequest } from 'payload'
import {
  companyReportInput,
  CompanyReportInputError,
  getCompanyUsage,
  type CompanyUsageReport,
} from '@/lib/companyUsage'

type Params = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const stamp = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—'

export async function CompanyUsageView({
  payload,
  user,
  searchParams = {},
}: {
  payload: Payload
  user: PayloadRequest['user']
  searchParams?: Params
}) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const providerId = first(searchParams.providerId) ?? '',
    from = first(searchParams.from) ?? today.slice(0, 8) + '01',
    to = first(searchParams.to) ?? today
  const providers: { id: number; name: string }[] = []
  let page = 1,
    more = true
  while (more) {
    const result = await payload.find({
      collection: 'access-providers',
      sort: 'name',
      limit: 500,
      page,
      depth: 0,
      select: { name: true },
      overrideAccess: false,
      user,
    })
    providers.push(...result.docs)
    more = result.hasNextPage
    page++
  }
  let report: CompanyUsageReport | undefined, error: string | undefined
  if (providerId)
    try {
      report = await getCompanyUsage(payload, user, companyReportInput(providerId, from, to))
    } catch (e) {
      if (e instanceof CompanyReportInputError) error = e.message
      else throw e
    }
  return (
    <>
      <form method="GET" action="/admin/company-reports" className="nic-company-report__filters">
        <label>
          Company / access provider
          <select name="providerId" required defaultValue={providerId}>
            <option value="">Choose a company</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" name="from" required defaultValue={from} />
        </label>
        <label>
          Through
          <input type="date" name="to" required defaultValue={to} />
        </label>
        <button className="nic-workspace__button" type="submit">
          Run report
        </button>
      </form>
      <p className="nic-analytics__muted">
        Dates include the full day in Eastern time. All current users of the selected provider are
        included, even with no recorded activity. Historical provider assignments are not retained.
      </p>
      <p className="nic-analytics__muted">
        Usage means recorded signed-in website page views. Staff visits, signed-out visits, email
        opens, time spent and reading completion are not included. No activity means no recorded
        views in this period.
      </p>
      {error && <p role="alert">{error}</p>}
      {!providerId && (
        <div className="nic-workspace__panel">Choose a company and date range to run a report.</div>
      )}
      {report && (
        <section aria-label="Company usage results">
          <div className="nic-workspace__section-heading">
            <h2>{report.provider.name}</h2>
            <a
              className="nic-workspace__button nic-workspace__button--secondary"
              href={
                '/api/admin/company-reports/export?' + new URLSearchParams({ providerId, from, to })
              }
            >
              Download CSV
            </a>
          </div>
          <p>
            {from} through {to} · Eastern time
          </p>
          <div className="nic-workspace__stats">
            {[
              ['Users', report.totals.users],
              ['Active users', report.totals.active],
              ['Page views', report.totals.views],
            ].map(([label, value]) => (
              <div className="nic-analytics__card" key={label}>
                <span>{label}</span>
                <strong>{Number(value).toLocaleString()}</strong>
              </div>
            ))}
          </div>
          {!report.rows.length ? (
            <p>No users are currently assigned to this provider.</p>
          ) : (
            <div className="nic-company-report__table">
              <table className="nic-analytics__table">
                <thead>
                  <tr>
                    {[
                      'User',
                      'Status',
                      'Page views',
                      'Active days',
                      'Distinct pages',
                      'First / last activity (ET)',
                      'Usage summary',
                    ].map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={'/admin/collections/users/' + r.id}>{r.name || r.email}</Link>
                        {r.name && <small>{r.email}</small>}
                      </td>
                      <td>{r.status}</td>
                      <td>{r.views}</td>
                      <td>{r.days}</td>
                      <td>{r.pages}</td>
                      <td>
                        {stamp(r.firstView)}
                        <small>{stamp(r.lastView)}</small>
                      </td>
                      <td>
                        {!r.views ? (
                          'No recorded activity'
                        ) : (
                          <>
                            <span>
                              {r.sections.map(([label, count]) => `${label}: ${count}`).join(' · ')}
                            </span>
                            <details>
                              <summary>Top pages</summary>
                              <ul>
                                {r.topPages.map((p) => (
                                  <li key={p.path}>
                                    {p.path} ({p.count})
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )
}
