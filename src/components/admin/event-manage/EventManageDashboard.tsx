import React from 'react'
import Link from 'next/link'
import { eventTiming } from '@/lib/eventTiming'

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
  sessionCount,
  activeAttendeeCount,
  registrationCount,
  sessions,
  allSponsors,
  allSpeakers,
  discountCodes,
  registrations,
  accessProviders,
  canManageRegistrations,
  operationsOnly = false,
  adminEditUrl,
  attendeeReport,
  attendeeReportTotals,
  sessionPopularity,
}: EventManageDashboardProps) {
  const timing = eventTiming(event)
  return (
    <div className="nic-event-dashboard">
      <div className="nic-event-dashboard__overview">
        <div>
          <span className="nic-workspace__status">{timing.status} · {event._status}</span>
          <p>{CHANNELS[event.channel].name} · {timing.dates} · {timing.timeZone}</p>
        </div>
        {!operationsOnly && (
          <Link href={adminEditUrl} className="nic-workspace__button nic-workspace__button--secondary">Event settings</Link>
        )}
      </div>
      <dl className="nic-event-dashboard__facts" aria-label="Event facts">
        <div><dt>{timing.status === 'Ended' ? 'Event status' : 'Days remaining'}</dt><dd>{timing.status === 'Ended' ? 'Ended' : timing.daysRemaining}</dd></div>
        {canManageRegistrations && <div><dt>Active attendees</dt><dd>{activeAttendeeCount}</dd></div>}
        {!operationsOnly && <>
          <div><dt>Agenda sessions</dt><dd>{sessionCount}</dd></div>
          <div><dt>Speakers</dt><dd>{event.speakers?.length ?? 0}</dd></div>
          <div><dt>Sponsors</dt><dd>{event.sponsors?.length ?? 0}</dd></div>
        </>}
      </dl>
      <nav aria-label="Event sections" className="nic-event-dashboard__sections">
        {!operationsOnly && <><a href="#speakers">Speakers</a><a href="#sponsors">Sponsors</a><a href="#agenda">Agenda</a><a href="#tickets">Tickets</a></>}
        {canManageRegistrations && <><a href="#attendees">Find or register attendees</a><a href="#discounts">Discounts</a><a href="#event-report">Attendance report</a><Link href={`/admin/collections/orders?where[event][equals]=${event.id}`}>Event orders</Link></>}
      </nav>
      {!operationsOnly && (
        <>
          <section id="speakers"><SpeakersSection event={event} allSpeakers={allSpeakers} /></section>
          <section id="sponsors"><SponsorsSection event={event} allSponsors={allSponsors} /></section>
          <section id="agenda"><SessionsSection event={event} sessions={sessions} totalCount={sessionCount} /></section>
        </>
      )}
      {!operationsOnly && <section id="tickets"><TicketTypesSection event={event} /></section>}

      {canManageRegistrations ? (
        <>
          {operationsOnly && (
            <section id="attendees"><AttendeesSection event={event} registrations={registrations} totalCount={registrationCount} /></section>
          )}
          <section id="discounts"><DiscountCodesSection
            event={event}
            discountCodes={discountCodes}
            accessProviders={accessProviders}
          /></section>
          {!operationsOnly && (
            <section id="attendees"><AttendeesSection event={event} registrations={registrations} totalCount={registrationCount} /></section>
          )}
          <section id="event-report"><AttendeeReportSection
            event={event}
            rows={attendeeReport}
            totals={attendeeReportTotals}
            sessionPopularity={sessionPopularity}
          /></section>
          {operationsOnly && <TicketTypesSection event={event} />}
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
