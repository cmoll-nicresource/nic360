import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan } from '@/access/readerPlan'

export const dynamic = 'force-dynamic'

export default async function AccessCheckPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const { docs: users } = await payload.find({
    collection: 'users',
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })

  const rows = await Promise.all(
    users.map(async (user) => {
      const plan = await getReaderPlan(user, payload)
      const provider =
        user.accessProvider && typeof user.accessProvider === 'object' ? user.accessProvider : null
      return { user, plan, provider }
    }),
  )

  return (
    <div className="page">
      <h1>Access check</h1>
      <p className="muted">
        Internal test page (Milestone 1 &ldquo;done when&rdquo; criterion): what can each seeded
        user read, derived from <code>getReaderPlan()</code> — the one helper every access.read
        function and protected route calls.
      </p>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Access provider</th>
              <th>Provider status</th>
              <th>Provider plan</th>
              <th>Effective plan</th>
              <th>Can read</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user, plan, provider }) => (
              <tr key={user.id}>
                <td>
                  {user.firstName} {user.lastName}
                  <br />
                  <span className="muted">{user.email}</span>
                </td>
                <td>{provider?.name ?? <span className="muted">none (event-only)</span>}</td>
                <td>{provider?.status ?? '—'}</td>
                <td>{provider?.plan ?? '—'}</td>
                <td>
                  <span className={`badge badge-${plan}`}>{plan}</span>
                </td>
                <td className="muted">
                  {plan === 'premium'
                    ? 'Excerpts, Guides/Publications, Data'
                    : plan === 'base'
                      ? 'Excerpts, Guides/Publications'
                      : 'Only events registered for'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
