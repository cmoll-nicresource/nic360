import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { staffHasRole } from '@/access/staffRoles'
import { adminDocumentId } from '@/config/staffWorkspace'
import { TradeImportWizard } from '@/components/TradeImportWizard'
import { ImportWizard } from '@/components/ImportWizard'
import { RunUsptoImportButton } from '@/components/RunUsptoImportButton'
import { RunTrademarkReportButton } from '@/components/RunTrademarkReportButton'
import { GenerateTrademarkReport } from '@/components/GenerateTrademarkReport'
import { EventManageDashboard } from '@/components/admin/event-manage/EventManageDashboard'
import { AnalyticsView } from '@/components/admin/analytics/AnalyticsView'
import { CompanyUsageView } from '@/components/admin/analytics/CompanyUsageView'
import {
  getAttendeeReport,
  getSessionPopularity,
  summarizeAttendeeReport,
} from '@/lib/eventAnalytics'
import { getSubscriptionPlan } from '@/access/subscriptionPlan'
import { requireWorkspaceRole, WorkspacePage, WorkspaceShell } from './WorkspaceShell'

export function TradeReportsView(props: AdminViewServerProps) {
  requireWorkspaceRole(props)
  return (
    <WorkspaceShell props={props}>
      <WorkspacePage
        title="Trade Barometer"
        eyebrow="IMPORTS & REPORTS"
        description="Upload your monthly Census files to refresh the datasets and prepare a complete PDF report."
        actions={
          <Link className="nic-workspace__text-link" href="/admin/collections/trade-import-runs">
            Import history →
          </Link>
        }
      >
        <div className="nic-workspace__workflow">
          <span>
            <b>01</b> Upload files
          </span>
          <span>
            <b>02</b> Preview & confirm
          </span>
          <span>
            <b>03</b> Review draft PDF
          </span>
        </div>
        <div className="nic-workspace__tool-layout">
          <div>
            <TradeImportWizard />
          </div>
          <aside className="nic-workspace__panel nic-workspace__help">
            <h2>Your monthly report</h2>
            <p>
              Use the <strong>Imp_MMYYYY.xls</strong> and <strong>Exp_MMYYYY.xls</strong> files
              supplied by Census.
            </p>
            <p>
              US trade figures and weekly CBP quota data are fetched automatically. The release date
              is the generation date.
            </p>
            <p>
              Existing months are replaced after confirmation. Each successful run creates a new
              draft for review.
            </p>
            <Link href="/admin/collections/publication-issues">Review publication issues →</Link>
          </aside>
        </div>
      </WorkspacePage>
    </WorkspaceShell>
  )
}

export function TrademarkReportsView(props: AdminViewServerProps) {
  requireWorkspaceRole(props, 'gatekeeper')
  return (
    <WorkspaceShell props={props}>
      <WorkspacePage
        title="Trademark reports"
        eyebrow="IMPORTS & REPORTS"
        description="Import class-34 filings from the USPTO Gazette and prepare weekly and monthly trademark issues."
        actions={<Link href="/admin/collections/trademark-import-runs">Import history →</Link>}
      >
        <div className="nic-workspace__tool-layout">
          <section>
            <h2>Live USPTO import</h2>
            <RunUsptoImportButton />
            <GenerateTrademarkReport />
            <details className="nic-workspace__panel">
              <summary>Development tools</summary>
              <p className="muted">
                Run the small offline fixture through the same import workflow.
              </p>
              <RunTrademarkReportButton />
            </details>
          </section>
          <aside className="nic-workspace__panel nic-workspace__help">
            <h2>Scheduled every Friday</h2>
            <p>
              The live import runs automatically each Friday. Use this screen to run a particular
              Gazette issue or retry an import.
            </p>
            <p>
              The weekly report covers seven days through the Gazette issue date. The first issue
              date of a month within days 1-7 also drafts activity for the previous calendar month.
            </p>
            <p>
              Monthly reports include published marks, cancellations and renewals. Every Tuesday
              Gazette issue in that month must have a successful import; missing issue dates are
              shown as an error.
            </p>
            <p>
              Generate a report separately to choose any reporting week or month. Each generation
              creates a fresh draft for review.
            </p>
            <Link href="/admin/collections/publication-issues">Review publication issues →</Link>
          </aside>
        </div>
      </WorkspacePage>
    </WorkspaceShell>
  )
}

export async function DatasetImportsView(props: AdminViewServerProps) {
  const req = requireWorkspaceRole(props)
  const result = await req.payload.find({
    collection: 'datasets',
    limit: 100,
    sort: 'title',
    depth: 0,
    req,
    overrideAccess: false,
  })
  return (
    <WorkspaceShell props={props}>
      <WorkspacePage
        title="Dataset imports"
        eyebrow="IMPORTS & REPORTS"
        description="Choose a dataset to upload a spreadsheet, map its columns, and preview the results."
        actions={<Link href="/admin/collections/datasets">Manage datasets →</Link>}
      >
        <div className="nic-workspace__task-grid">
          {result.docs.map((dataset) => (
            <Link
              key={dataset.id}
              className="nic-workspace__task"
              href={`/admin/datasets/${dataset.id}/import`}
            >
              <span className="nic-workspace__eyebrow">DATASET</span>
              <h3>{dataset.title}</h3>
              <p>{dataset.columns.length} defined columns</p>
              <span className="nic-workspace__task-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>
        {!result.docs.length && (
          <div className="nic-workspace__panel">
            <h2>No datasets yet</h2>
            <p>Create a dataset and define its columns before importing.</p>
            <Link href="/admin/collections/datasets/create">Create dataset →</Link>
          </div>
        )}
        {result.hasNextPage && (
          <p>
            Showing the first 100 datasets.{' '}
            <Link href="/admin/collections/datasets">Browse all {result.totalDocs} datasets →</Link>
          </p>
        )}
      </WorkspacePage>
    </WorkspaceShell>
  )
}

export async function DatasetImportView(props: AdminViewServerProps) {
  const req = requireWorkspaceRole(props)
  const id = adminDocumentId(props.params, 'datasets')
  if (!id) notFound()
  const {
    docs: [dataset],
  } = await req.payload.find({
    collection: 'datasets',
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
    req,
    overrideAccess: false,
  })
  if (!dataset) notFound()
  return (
    <WorkspaceShell props={props}>
      <WorkspacePage
        title={`Import: ${dataset.title}`}
        eyebrow="DATASET IMPORT"
        description="Upload a CSV, map its headers, preview your data, then confirm the import."
        actions={<Link href={`/admin/collections/datasets/${dataset.id}`}>Dataset settings →</Link>}
      >
        <ImportWizard datasetId={String(dataset.id)} datasetSlug={dataset.slug} />
      </WorkspacePage>
    </WorkspaceShell>
  )
}

export async function EventsWorkspaceView(props: AdminViewServerProps) {
  const req = requireWorkspaceRole(props)
  const pastOnly = props.searchParams?.period === 'past'
  const page = Math.max(1, Math.floor(Number(props.searchParams?.page) || 1))
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const events = await req.payload.find({
    collection: 'events',
    ...(pastOnly ? { where: { endDate: { less_than: `${today}T00:00:00.000Z` } } } : {}),
    page,
    limit: 24,
    sort: '-startsAt',
    depth: 0,
    draft: true,
    req,
    overrideAccess: false,
  })
  return (
    <WorkspaceShell props={props}>
      <WorkspacePage
        title={pastOnly ? 'Past events' : 'Event management'}
        eyebrow="OPERATIONS"
        description="One place for each event’s program, speakers, sponsors, tickets, and attendees."
        actions={
          !(req.user?.collection === 'staff' && req.user.role === 'gatekeeper') && (
            <Link className="nic-workspace__button" href="/admin/collections/events/create">
              Create event →
            </Link>
          )
        }
      >
        <div className="nic-workspace__task-grid">
          {events.docs.map((event) => (
            <Link
              className="nic-workspace__task"
              key={event.id}
              href={`/admin/events/${event.id}/manage`}
            >
              <span className="nic-workspace__eyebrow">{event.channel}</span>
              <h3>{event.name}</h3>
              <p>
                {new Intl.DateTimeFormat('en-US', {
                  dateStyle: 'medium',
                  timeZone: event.timezone || 'America/New_York',
                }).format(new Date(event.startsAt))}
              </p>
              <span className="nic-workspace__task-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>
        {!events.docs.length && (
          <p className="nic-workspace__empty">
            No events yet. Create your first event to start building its program.
          </p>
        )}
        <p>
          <Link href="/admin/collections/events">Browse all {events.totalDocs} events →</Link>
        </p>
        <div className="nic-workspace__pagination">
          {events.hasPrevPage && <Link href={`/admin/events?${pastOnly ? 'period=past&' : ''}page=${page - 1}`}>Previous page</Link>}
          {events.hasNextPage && <Link href={`/admin/events?${pastOnly ? 'period=past&' : ''}page=${page + 1}`}>Next page</Link>}
        </div>
      </WorkspacePage>
    </WorkspaceShell>
  )
}

export async function ManageEventView(props: AdminViewServerProps) {
  const req = requireWorkspaceRole(props)
  const payload = req.payload
  const id = adminDocumentId(props.params, 'events')
  if (!id) notFound()
  const {
    docs: [event],
  } = await payload.find({
    collection: 'events',
    where: { id: { equals: id } },
    limit: 1,
    depth: 2,
    draft: true,
    req,
    overrideAccess: false,
  })
  if (!event) notFound()
  const canManageRegistrations = staffHasRole(req.user, 'gatekeeper')
  const options = { req, overrideAccess: false as const }
  const [sessions, sponsors, speakers, codes, registrations, providers, attendeeReport, activeAttendees] =
    await Promise.all([
      payload.find({
        collection: 'sessions',
        where: { event: { equals: event.id } },
        depth: 1,
        limit: 200,
        sort: 'day',
        draft: true,
        ...options,
      }),
      payload.find({ collection: 'sponsors', limit: 200, sort: 'name', depth: 1, ...options }),
      payload.find({ collection: 'speakers', limit: 200, sort: 'name', depth: 1, ...options }),
      canManageRegistrations
        ? payload.find({
            collection: 'discount-codes',
            where: { event: { equals: event.id } },
            limit: 200,
            sort: 'code',
            depth: 1,
            ...options,
          })
        : Promise.resolve({ docs: [] }),
      canManageRegistrations
        ? payload.find({
            collection: 'event-registrations',
            where: { event: { equals: event.id } },
            limit: 500,
            sort: '-createdAt',
            depth: 1,
            ...options,
          })
        : Promise.resolve({ docs: [] }),
      canManageRegistrations
        ? payload.find({
            collection: 'access-providers',
            limit: 200,
            sort: 'name',
            depth: 0,
            ...options,
          })
        : Promise.resolve({ docs: [] }),
      canManageRegistrations ? getAttendeeReport(payload, event.id) : Promise.resolve([]),
      canManageRegistrations
        ? payload.count({ collection: 'event-registrations', where: { and: [{ event: { equals: event.id } }, { status: { equals: 'active' } }] }, ...options })
        : Promise.resolve(null),
    ])
  return (
    <WorkspaceShell props={props}>
      <WorkspacePage
        title={event.name}
        eyebrow="EVENT OPERATIONS"
        description="Manage the complete event without switching between collections."
        actions={<Link href="/admin/events">All events →</Link>}
      >
        <EventManageDashboard
          event={event}
          sessionCount={sessions.totalDocs}
          activeAttendeeCount={activeAttendees?.totalDocs ?? null}
          registrationCount={'totalDocs' in registrations ? registrations.totalDocs as number : 0}
          sessions={sessions.docs}
          allSponsors={sponsors.docs}
          allSpeakers={speakers.docs}
          discountCodes={codes.docs}
          registrations={registrations.docs}
          accessProviders={providers.docs.map((p) => ({ id: p.id, name: p.name }))}
          canManageRegistrations={canManageRegistrations}
          operationsOnly={req.user?.collection === 'staff' && req.user.role === 'gatekeeper'}
          adminEditUrl={`/admin/collections/events/${event.id}`}
          attendeeReport={attendeeReport}
          attendeeReportTotals={summarizeAttendeeReport(attendeeReport)}
          sessionPopularity={getSessionPopularity(attendeeReport)}
        />
      </WorkspacePage>
    </WorkspaceShell>
  )
}

export async function AccessCheckView(props: AdminViewServerProps) {
  const req = requireWorkspaceRole(props, 'gatekeeper')
  const { docs: users, totalDocs } = await req.payload.find({
    collection: 'users',
    limit: 200,
    depth: 1,
    req,
    overrideAccess: false,
  })
  const rows = await Promise.all(
    users.map(async (user) => ({ user, plan: await getSubscriptionPlan(user, req.payload) })),
  )
  return (
    <WorkspaceShell props={props}>
      <WorkspacePage
        title="User access"
        eyebrow="AUDIENCE & ACCESS"
        description="Check effective subscription plans and access providers."
        actions={<Link href="/admin/collections/users">Manage users →</Link>}
      >
        <div className="nic-workspace__panel">
          <div className="nic-workspace__table-scroll">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Access provider</th>
                  <th>Effective plan</th>
                  <th>User access</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ user, plan }) => (
                  <tr key={user.id}>
                    <td>
                      <Link href={`/admin/collections/users/${user.id}`}>
                        {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
                      </Link>
                      <small className="muted">{user.email}</small>
                    </td>
                    <td>
                      {typeof user.accessProvider === 'object' && user.accessProvider
                        ? user.accessProvider.name
                        : 'No access provider'}
                    </td>
                    <td>
                      <span className="nic-workspace__status">{plan}</span>
                    </td>
                    <td>
                      {plan === 'premium'
                        ? 'Tracking, guides, publications & data'
                        : plan === 'base'
                          ? 'Tracking, guides & publications'
                          : 'No subscription access'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalDocs > users.length && (
            <p>
              Showing {users.length} of {totalDocs} users.{' '}
              <Link href="/admin/collections/users">Search all users →</Link>
            </p>
          )}
        </div>
      </WorkspacePage>
    </WorkspaceShell>
  )
}

export function WorkspaceAnalyticsView(props: AdminViewServerProps) {
  const req = requireWorkspaceRole(props, 'gatekeeper')
  return (
    <WorkspaceShell props={props}>
      <AnalyticsView payload={req.payload} user={req.user} searchParams={props.searchParams} />
    </WorkspaceShell>
  )
}

export function CompanyReportsView(props: AdminViewServerProps) {
  const req = requireWorkspaceRole(props, 'gatekeeper')
  return (
    <WorkspaceShell props={props}>
      <WorkspacePage
        title="Company usage reports"
        eyebrow="USER OPERATIONS"
        description="Review each company's users and their website activity over a date range."
      >
        <CompanyUsageView payload={req.payload} user={req.user} searchParams={props.searchParams} />
      </WorkspacePage>
    </WorkspaceShell>
  )
}
