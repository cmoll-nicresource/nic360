import { headers as getHeaders } from 'next/headers.js'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { staffHasRole } from '@/access/staffRoles'
import { SiteNav } from '@/components/SiteNav'
import { EventManageDashboard } from '@/components/admin/event-manage/EventManageDashboard'
import { getAttendeeReport, getSessionPopularity, summarizeAttendeeReport } from '@/lib/eventAnalytics'
import type { AccessProvider, DiscountCode, EventRegistration } from '@/payload-types'

export const dynamic = 'force-dynamic'

export default async function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!staffHasRole(user, 'editor')) {
    return (
      <>
        <SiteNav />
        <div className="page">
          <h1>Manage event</h1>
          <p>Staff sign-in required. Use the admin panel login, then reopen this link.</p>
        </div>
      </>
    )
  }

  const event = await payload.findByID({ collection: 'events', id, depth: 2, overrideAccess: true }).catch(() => null)
  if (!event) notFound()

  const canManageRegistrations = staffHasRole(user, 'gatekeeper')

  const [{ docs: sessions }, { docs: allSponsors }, { docs: allSpeakers }, { docs: allUsers }] = await Promise.all([
    payload.find({
      collection: 'sessions',
      where: { event: { equals: event.id } },
      depth: 1,
      limit: 200,
      sort: 'day',
      overrideAccess: true,
    }),
    payload.find({ collection: 'sponsors', limit: 200, sort: 'name', depth: 1, overrideAccess: true }),
    payload.find({ collection: 'speakers', limit: 200, sort: 'name', depth: 1, overrideAccess: true }),
    payload.find({ collection: 'users', limit: 500, sort: 'email', depth: 0, overrideAccess: true }),
  ])

  let discountCodes: DiscountCode[] = []
  let registrations: EventRegistration[] = []
  let accessProviders: AccessProvider[] = []
  let attendeeReport: Awaited<ReturnType<typeof getAttendeeReport>> = []
  if (canManageRegistrations) {
    const [codesResult, regsResult, providersResult, report] = await Promise.all([
      payload.find({
        collection: 'discount-codes',
        where: { event: { equals: event.id } },
        depth: 1,
        limit: 200,
        sort: 'code',
        overrideAccess: true,
      }),
      payload.find({
        collection: 'event-registrations',
        where: { event: { equals: event.id } },
        depth: 1,
        limit: 500,
        sort: '-createdAt',
        overrideAccess: true,
      }),
      payload.find({ collection: 'access-providers', limit: 200, sort: 'name', depth: 0, overrideAccess: true }),
      getAttendeeReport(payload, event.id),
    ])
    discountCodes = codesResult.docs
    registrations = regsResult.docs
    accessProviders = providersResult.docs
    attendeeReport = report
  }

  return (
    <>
      <SiteNav />
      <EventManageDashboard
        event={event}
        sessions={sessions}
        allSponsors={allSponsors}
        allSpeakers={allSpeakers}
        allUsers={allUsers.map((u) => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName }))}
        discountCodes={discountCodes}
        registrations={registrations}
        accessProviders={accessProviders.map((p) => ({ id: p.id, name: p.name }))}
        canManageRegistrations={canManageRegistrations}
        adminEditUrl={`${payloadConfig.routes.admin}/collections/events/${event.id}`}
        attendeeReport={attendeeReport}
        attendeeReportTotals={summarizeAttendeeReport(attendeeReport)}
        sessionPopularity={getSessionPopularity(attendeeReport)}
      />
    </>
  )
}
