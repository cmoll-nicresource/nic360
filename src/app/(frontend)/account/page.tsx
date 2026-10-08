import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan } from '@/access/readerPlan'

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
        <p className="muted">
          Coming in Milestone 4, once Publications exist. This is where you&apos;ll choose which
          newsletters to receive.
        </p>
      </div>
    </div>
  )
}
