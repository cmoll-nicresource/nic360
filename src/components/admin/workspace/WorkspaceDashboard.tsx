import Link from 'next/link'
import type { AdminViewServerProps, Where } from 'payload'
import { staffTasksFor } from '@/config/staffWorkspace'
import {
  canSeeEditorialWorkspace,
  canSeeUserWorkspace,
  workspaceRole,
} from '@/config/workspaceVisibility'
import { requireWorkspaceRole, TaskIcon, WorkspacePage } from './WorkspaceShell'

const date = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date(value))

export async function WorkspaceDashboard(props: AdminViewServerProps) {
  const req = requireWorkspaceRole(props),
    payload = req.payload,
    role = workspaceRole(req.user)
  const editorial = canSeeEditorialWorkspace(req.user),
    userOperations = canSeeUserWorkspace(req.user)
  const options = { depth: 0, req, overrideAccess: false as const }
  const attention: Where = {
    or: [
      { status: { equals: 'pending' } },
      { and: [{ fulfillmentError: { exists: true } }, { fulfillmentError: { not_equals: '' } }] },
    ],
  }
  const [drafts, news, bills, users, orders, flags, alerts] = await Promise.all([
    editorial
      ? payload.find({
          collection: 'publication-issues',
          where: { _status: { equals: 'draft' } },
          sort: '-updatedAt',
          limit: 5,
          draft: true,
          ...options,
        })
      : null,
    editorial
      ? payload.find({
          collection: 'articles',
          limit: 0,
          where: { _status: { equals: 'draft' } },
          draft: true,
          ...options,
        })
      : null,
    editorial
      ? payload.find({
          collection: 'bills',
          limit: 0,
          where: { _status: { equals: 'draft' } },
          draft: true,
          ...options,
        })
      : null,
    userOperations
      ? payload.find({ collection: 'users', sort: '-createdAt', limit: 5, ...options })
      : null,
    userOperations
      ? payload.find({
          collection: 'orders',
          where: attention,
          sort: '-createdAt',
          limit: 5,
          ...options,
        })
      : null,
    userOperations
      ? payload.count({
          collection: 'email-flags',
          where: { status: { not_equals: 'resolved' } },
          ...options,
        })
      : null,
    editorial
      ? payload.count({
          collection: 'operational-alerts',
          where: { resolved: { equals: false } },
          ...options,
        })
      : null,
  ])
  const tasks = staffTasksFor(req.user)
  const title =
    role === 'admin'
      ? 'Administration workspace'
      : role === 'gatekeeper'
        ? 'Users & events'
        : 'Editorial desk'
  return (
    <WorkspacePage
      title={title}
      eyebrow={`NICOTINE360 · ${role === 'admin' ? 'ADMIN' : role === 'gatekeeper' ? 'USER OPERATIONS' : 'EDITORIAL'}`}
      description={
        role === 'gatekeeper'
          ? 'Look after user access, registrations and orders.'
          : role === 'admin'
            ? 'Daily publishing and user operations, with administration in one place.'
            : 'Enter today’s excerpts, continue your drafts and prepare the next edition.'
      }
      actions={
        <Link className="nic-workspace__button nic-workspace__button--secondary" href="/">
          View public site ↗
        </Link>
      }
    >
      {alerts && alerts.totalDocs > 0 && (
        <div className="nic-workspace__panel" role="status">
          <strong>{alerts.totalDocs} operational alerts need attention.</strong>{' '}
          <Link href="/admin/collections/operational-alerts?where[resolved][equals]=false">
            Review failed sends and imports →
          </Link>
        </div>
      )}
      <TaskSections tasks={tasks} daily />
      {editorial && (
        <section className="nic-workspace__section">
          <div className="nic-workspace__section-heading">
            <h2>Editorial work in progress</h2>
            <span>Drafts across the desk</span>
          </div>
          <div className="nic-workspace__stats">
            {[
              ['News drafts', news?.totalDocs, 'articles'],
              ['Legislation drafts', bills?.totalDocs, 'bills'],
              ['Publication drafts', drafts?.totalDocs, 'publication-issues'],
            ].map(([label, count, slug]) => (
              <Link
                key={String(slug)}
                href={`/admin/collections/${slug}?where[_status][equals]=draft`}
              >
                <span>{label}</span>
                <strong>{Number(count || 0).toLocaleString()}</strong>
                <small>Continue editing →</small>
              </Link>
            ))}
          </div>
          <section className="nic-workspace__panel">
            <div className="nic-workspace__section-heading">
              <h2>Recent publication drafts</h2>
              <Link href="/admin/collections/publication-issues">All issues →</Link>
            </div>
            {drafts?.docs.length ? (
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
                No draft issues. Create an issue when you’re ready for the next edition.
              </p>
            )}
          </section>
        </section>
      )}
      {userOperations && (
        <section className="nic-workspace__section">
          <div className="nic-workspace__section-heading">
            <h2>User follow-up</h2>
            <span>Accounts, delivery and payments</span>
          </div>
          <div className="nic-workspace__stats">
            <Link href="/admin/collections/users">
              <span>User accounts</span>
              <strong>{users?.totalDocs.toLocaleString()}</strong>
              <small>Find or update a user →</small>
            </Link>
            <Link href="/admin/collections/orders">
              <span>Orders to review</span>
              <strong>{orders?.totalDocs.toLocaleString()}</strong>
              <small>Pending payments or fulfillment errors</small>
            </Link>
            <Link href="/admin/collections/email-flags">
              <span>Email flags to resolve</span>
              <strong>{flags?.totalDocs.toLocaleString()}</strong>
              <small>Review delivery follow-up →</small>
            </Link>
          </div>
          <div className="nic-workspace__columns">
            <section className="nic-workspace__panel">
              <div className="nic-workspace__section-heading">
                <h2>Orders needing attention</h2>
                <Link href="/admin/collections/orders">All orders →</Link>
              </div>
              {orders?.docs.length ? (
                orders.docs.map((order) => (
                  <Link
                    href={`/admin/collections/orders/${order.id}`}
                    className="nic-workspace__list-row"
                    key={order.id}
                  >
                    <div>
                      <strong>
                        Order #{order.id} ·{' '}
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        }).format(order.total)}
                      </strong>
                      <small>
                        {order.fulfillmentError
                          ? 'Fulfillment needs review'
                          : `Created ${date(order.createdAt)}`}
                      </small>
                    </div>
                    <span className="nic-workspace__status">{order.status}</span>
                  </Link>
                ))
              ) : (
                <p className="nic-workspace__empty">No pending orders or fulfillment errors.</p>
              )}
            </section>
            <section className="nic-workspace__panel">
              <div className="nic-workspace__section-heading">
                <h2>Recently registered users</h2>
                <Link href="/admin/collections/users">All users →</Link>
              </div>
              {users?.docs.length ? (
                users.docs.map((user) => (
                  <Link
                    href={`/admin/collections/users/${user.id}`}
                    className="nic-workspace__list-row"
                    key={user.id}
                  >
                    <div>
                      <strong>{user.email}</strong>
                      <small>
                        {[user.firstName, user.lastName].filter(Boolean).join(' ') ||
                          `Registered ${date(user.createdAt)}`}
                      </small>
                    </div>
                    <span className="nic-workspace__status">{user.status}</span>
                  </Link>
                ))
              ) : (
                <p className="nic-workspace__empty">New user accounts will appear here.</p>
              )}
            </section>
          </div>
        </section>
      )}
      <TaskSections tasks={tasks} daily={false} />
    </WorkspacePage>
  )
}

function TaskSections({
  tasks,
  daily,
}: {
  tasks: ReturnType<typeof staffTasksFor>
  daily: boolean
}) {
  const visible = tasks.filter((task) => Boolean(task.daily) === daily),
    categories = [...new Set(visible.map((task) => task.category))]
  return (
    <>
      {categories.map((category) => (
        <section
          className={`nic-workspace__section ${daily ? 'nic-workspace__section--daily' : ''}`}
          key={category}
        >
          <div className="nic-workspace__section-heading">
            <h2>{category}</h2>
            <span>
              {daily
                ? 'Your most-used actions'
                : category === 'Periodic reports & imports'
                  ? 'Weekly, monthly and as needed'
                  : category === 'Administration'
                    ? 'Admin only'
                    : 'Browse and maintain'}
            </span>
          </div>
          <div
            className={`nic-workspace__task-grid ${daily ? 'nic-workspace__task-grid--daily' : ''}`}
          >
            {visible
              .filter((task) => task.category === category)
              .map((task) => (
                <Link
                  href={task.href}
                  className={`nic-workspace__task ${daily ? 'nic-workspace__task--daily' : ''}`}
                  key={task.href}
                >
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
    </>
  )
}
