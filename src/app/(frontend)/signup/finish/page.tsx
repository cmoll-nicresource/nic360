import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { SiteNav } from '@/components/SiteNav'
import { NoSubscriptionNotice } from '@/components/NoSubscriptionNotice'
import { PublicationPreferencesForm } from '@/components/PublicationPreferencesForm'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'

export const dynamic = 'force-dynamic'

export default async function SignupFinishPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!user || !('collection' in user) || user.collection !== 'users') {
    return (
      <>
        <SiteNav />
        <div className="page">
          <h1>Finish sign-up</h1>
          <p>
            <Link href="/signup">Start sign-up</Link> first.
          </p>
        </div>
      </>
    )
  }

  const fullUser = await payload.findByID({ collection: 'users', id: user.id, depth: 1, overrideAccess: true })
  const plan = await getReaderPlan(fullUser, payload)
  const isSubscriber = planSatisfies(plan, 'base')

  return (
    <>
      <SiteNav />
      <div className="page">
        <h1>You&apos;re all set, {fullUser.firstName}</h1>

        {isSubscriber ? (
          <>
            <div className="card">
              <h2>Publication email preferences</h2>
              <p className="muted">Choose which newsletters you&apos;d like to receive. You can change this anytime from your account page.</p>
              <PublicationPreferencesAsync payload={payload} fullUser={fullUser} />
            </div>
            <p>
              <Link href="/dashboard" className="btn">
                Continue to your dashboard →
              </Link>
            </p>
          </>
        ) : (
          <>
            <NoSubscriptionNotice payload={payload} />
            <p>
              <Link href="/dashboard">Continue to your dashboard →</Link>
            </p>
          </>
        )}
      </div>
    </>
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
