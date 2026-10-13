import React from 'react'

import { CHANNELS } from '@/config/channels'
import type { EventManageDashboardProps } from './types'
import { SponsorsSection } from './SponsorsSection'
import { SpeakersSection } from './SpeakersSection'
import { SessionsSection } from './SessionsSection'
import { TicketTypesSection } from './TicketTypesSection'
import { DiscountCodesSection } from './DiscountCodesSection'
import { AttendeesSection } from './AttendeesSection'
import { AttendeeReportSection } from './AttendeeReportSection'

/**
 * One screen for everything staff do to run a single event — built because
 * managing sponsors/speakers/sessions/tickets/attendees one at a time
 * through separate admin collection screens meant re-picking the event on
 * every document. Each section below is already scoped to this event.
 */
export function EventManageDashboard({
  event,
  sessions,
  allSponsors,
  allSpeakers,
  allUsers,
  discountCodes,
  registrations,
  accessProviders,
  canManageRegistrations,
  adminEditUrl,
  attendeeReport,
  attendeeReportTotals,
  sessionPopularity,
}: EventManageDashboardProps) {
  return (
    <div className="page-wide">
      <div className="dashboard-header">
        <div>
          <h1 style={{ marginBottom: 4 }}>{event.name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {CHANNELS[event.channel].name} · {new Date(event.startsAt).toLocaleDateString()} –{' '}
            {new Date(event.endDate).toLocaleDateString()}
          </p>
        </div>
        <a href={adminEditUrl} className="btn-secondary btn" target="_blank" rel="noreferrer">
          Edit full event details →
        </a>
      </div>

      <SponsorsSection event={event} allSponsors={allSponsors} />
      <SpeakersSection event={event} allSpeakers={allSpeakers} />
      <SessionsSection event={event} sessions={sessions} />
      <TicketTypesSection event={event} />

      {canManageRegistrations ? (
        <>
          <DiscountCodesSection event={event} discountCodes={discountCodes} accessProviders={accessProviders} />
          <AttendeesSection event={event} registrations={registrations} allUsers={allUsers} />
          <AttendeeReportSection
            event={event}
            rows={attendeeReport}
            totals={attendeeReportTotals}
            sessionPopularity={sessionPopularity}
          />
        </>
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Discount codes &amp; attendees</h2>
          <p className="muted">Gatekeeper role required to manage discount codes and attendees.</p>
        </div>
      )}
    </div>
  )
}
