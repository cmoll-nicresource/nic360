import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { PublicationPreferencesForm } from '@/components/PublicationPreferencesForm'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'

function PlanBadge({ plan }: { plan: 'none' | 'base' | 'premium' }) {
  return <span className={`badge badge-${plan}`}>{plan}</span>
}

export default async function AccountPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!user || !('collection' in user) || user.collection !== 'users') {
    return (
      <div className="page">
        <h1>Account</h1>
        <p>
          You need to be signed in as a reader to see your account. Staff log in at{' '}
          <Link href={payloadConfig.routes.admin}>/admin</Link> instead.
        </p>
      </div>
    )
  }

  const fullUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 1,
  })

  const plan = await getReaderPlan(fullUser, payload)
  const provider =
    fullUser.accessProvider && typeof fullUser.accessProvider === 'object'
      ? fullUser.accessProvider
      : null

  return (
    <div className="page">
      <h1>Account</h1>

      <div className="card">
        <h2>Profile</h2>
        <table>
          <tbody>
            <tr>
              <th>Name</th>
              <td>
                {fullUser.firstName} {fullUser.lastName}
              </td>
            </tr>
            <tr>
              <th>Email</th>
              <td>{fullUser.email}</td>
            </tr>
            <tr>
              <th>Department</th>
              <td>{fullUser.department || <span className="muted">—</span>}</td>
            </tr>
            <tr>
              <th>Business sector</th>
              <td>{fullUser.businessSector || <span className="muted">—</span>}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Access</h2>
        <p>
          Plan: <PlanBadge plan={plan} />
        </p>
        <p className="muted">
          {provider
            ? `Via ${provider.name} (${provider.status}, ${provider.plan})`
            : 'No access provider on file — you can only read events you have registered for.'}
        </p>
      </div>

      <div className="card">
        <h2>Publication email preferences</h2>
        {planSatisfies(plan, 'base') ? (
          <PublicationPreferencesAsync payload={payload} fullUser={fullUser} />
        ) : (
          <p className="muted">
            Available once your company has a Base or Premium subscription.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Products purchased</h2>
        <EventRegistrationsAsync payload={payload} userId={fullUser.id} />
      </div>
    </div>
  )
}

async function EventRegistrationsAsync({ payload, userId }: { payload: Payload; userId: number }) {
  const { docs: registrations } = await payload.find({
    collection: 'event-registrations',
    where: { attendee: { equals: userId } },
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })

  if (registrations.length === 0) return <p className="muted">No event registrations yet.</p>

  return (
    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>Ticket type</th>
          <th>Attendance</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {registrations.map((r) => (
          <tr key={r.id}>
            <td>
              {typeof r.event === 'object' ? (
                <Link href={`/events/${r.event.id}`}>{r.event.name}</Link>
              ) : (
                r.event
              )}
            </td>
            <td>{r.ticketType}</td>
            <td>{r.attendance}</td>
            <td>{r.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

async function PublicationPreferencesAsync({
  payload,
  fullUser,
}: {
  payload: Payload
  fullUser: User
}) {
  const { docs: publications } = await payload.find({
    collection: 'publications',
    limit: 100,
    sort: 'title',
    overrideAccess: true,
  })
  const selectedIds = (fullUser.emailPublications ?? []).map((p: number | { id: number }) =>
    typeof p === 'object' ? p.id : p,
  )

  return (
    <PublicationPreferencesForm
      userId={fullUser.id}
      publications={publications.map((p) => ({ id: p.id, title: p.title, description: p.description }))}
      initialSelectedIds={selectedIds}
    />
  )
}
