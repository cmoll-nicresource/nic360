import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'
import { staffHasRole } from '@/access/staffRoles'
import { staffTasksFor } from '@/config/staffWorkspace'
import { requireWorkspaceRole, TaskIcon, WorkspacePage } from './WorkspaceShell'

const date = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date(value))

export async function WorkspaceDashboard(props: AdminViewServerProps) {
  const req = requireWorkspaceRole(props)
  const payload = req.payload
  const tasks = staffTasksFor(req.user)
  const [drafts, runs, events, flags, alerts] = await Promise.all([
    payload.find({
      collection: 'publication-issues',
      where: { _status: { equals: 'draft' } },
      sort: '-updatedAt',
      limit: 5,
      depth: 0,
      draft: true,
      req,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'trade-import-runs',
      sort: '-createdAt',
      limit: 4,
      depth: 0,
      req,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'events',
      sort: 'startsAt',
      where: { endDate: { greater_than_equal: new Date().toISOString() } },
      limit: 4,
      depth: 0,
      req,
      overrideAccess: false,
    }),
    staffHasRole(req.user, 'gatekeeper')
      ? payload.count({
          collection: 'email-flags',
          where: { status: { not_equals: 'resolved' } },
          req,
          overrideAccess: false,
        })
      : Promise.resolve(null),
    payload.count({
      collection: 'operational-alerts',
      where: { resolved: { equals: false } },
      req,
      overrideAccess: false,
    }),
  ])
  return (
    <WorkspacePage
      title="Your staff workspace"
      eyebrow="NICOTINE360 · EDITORIAL & OPERATIONS"
      description="Everything you need to publish, maintain your data, and look after your members."
      actions={
        <Link className="nic-workspace__button nic-workspace__button--secondary" href="/">
          View public site ↗
        </Link>
      }
    >
      {alerts.totalDocs > 0 && (
        <div className="nic-workspace__panel" role="status">
          <strong>
            {alerts.totalDocs} operational alert{alerts.totalDocs === 1 ? '' : 's'} need attention.
          </strong>{' '}
          <Link href="/admin/collections/operational-alerts?where[resolved][equals]=false">
            Review failed sends and imports →
          </Link>
        </div>
      )}
      <section className="nic-workspace__hero">
        <div>
          <span className="nic-workspace__eyebrow">MONTHLY WORKFLOW</span>
          <h2>
            From Census files
            <br />
            to a finished trade report.
          </h2>
          <p>
            Import the latest data, refresh the datasets, and prepare the Trade Barometer for review
            and sending.
          </p>
          <Link className="nic-workspace__button" href="/admin/trade-reports">
            Open Trade Barometer <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="nic-workspace__hero-aside">
          <span>
            01 <strong>Upload & preview</strong>
          </span>
          <span>
            02 <strong>Generate report</strong>
          </span>
          <span>
            03 <strong>Review & send</strong>
          </span>
          <small>US trade and CBP quota figures are fetched automatically.</small>
        </div>
      </section>
      <div className="nic-workspace__stats">
        <Link href="/admin/collections/publication-issues?where[_status][equals]=draft">
          <span>Draft publication issues</span>
          <strong>{drafts.totalDocs.toLocaleString()}</strong>
          <small>Ready for your review →</small>
        </Link>
        <Link href="/admin/events">
          <span>Upcoming events</span>
          <strong>{events.totalDocs.toLocaleString()}</strong>
          <small>Programs & attendees →</small>
        </Link>
        <Link
          href={flags ? '/admin/collections/email-flags' : '/admin/collections/trade-import-runs'}
        >
          <span>{flags ? 'Email flags to resolve' : 'Latest trade import'}</span>
          <strong>
            {flags ? flags.totalDocs.toLocaleString() : (runs.docs[0]?.status ?? 'No runs yet')}
          </strong>
          <small>{flags ? 'Membership follow-up →' : 'View import history →'}</small>
        </Link>
      </div>
      {['Imports & reports', 'Publishing', 'Operations'].map((category) => (
        <section className="nic-workspace__section" key={category}>
          <div className="nic-workspace__section-heading">
            <h2>{category}</h2>
            <span>
              {category === 'Publishing'
                ? 'Prepare, review, publish'
                : category === 'Operations'
                  ? 'People, events & insights'
                  : 'Keep your information current'}
            </span>
          </div>
          <div className="nic-workspace__task-grid">
            {tasks
              .filter((task) => task.category === category)
              .map((task) => (
                <Link href={task.href} className="nic-workspace__task" key={task.href}>
                  <span className="nic-workspace__task-icon">
                    <TaskIcon name={task.icon} />
                  </span>
                  <h3>{task.label}</h3>
                  <p>{task.description}</p>
                  <span className="nic-workspace__task-arrow" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ))}
      <div className="nic-workspace__columns">
        <section className="nic-workspace__panel">
          <div className="nic-workspace__section-heading">
            <h2>Recent trade imports</h2>
            <Link href="/admin/collections/trade-import-runs">All runs →</Link>
          </div>
          {runs.docs.length ? (
            runs.docs.map((run) => (
              <Link
                className="nic-workspace__list-row"
                href={`/admin/collections/trade-import-runs/${run.id}`}
                key={run.id}
              >
                <div>
                  <strong>{run.files?.import || run.files?.export || `Import #${run.id}`}</strong>
                  <small>{date(run.createdAt)}</small>
                </div>
                <span className={`nic-workspace__status nic-workspace__status--${run.status}`}>
                  {run.status}
                </span>
              </Link>
            ))
          ) : (
            <p className="nic-workspace__empty">
              No trade imports yet. Upload your first Census files to get started.
            </p>
          )}
        </section>
        <section className="nic-workspace__panel">
          <div className="nic-workspace__section-heading">
            <h2>Drafts awaiting review</h2>
            <Link href="/admin/collections/publication-issues">All issues →</Link>
          </div>
          {drafts.docs.length ? (
            drafts.docs.map((issue) => (
              <Link
                className="nic-workspace__list-row"
                href={`/admin/collections/publication-issues/${issue.id}`}
                key={issue.id}
              >
                <div>
                  <strong>{issue.title}</strong>
                  <small>Updated {date(issue.updatedAt)}</small>
                </div>
                <span aria-hidden="true">→</span>
              </Link>
            ))
          ) : (
            <p className="nic-workspace__empty">
              You’re up to date. New report drafts will appear here.
            </p>
          )}
        </section>
      </div>
    </WorkspacePage>
  )
}
