import React from 'react'

import type { AttendeeReportRow, AttendeeReportTotals, SessionPopularityRow } from '@/lib/eventAnalytics'
import type { Event } from '@/payload-types'

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function AttendeeReportSection({
  event,
  rows,
  totals,
  sessionPopularity,
}: {
  event: Event
  rows: AttendeeReportRow[]
  totals: AttendeeReportTotals
  sessionPopularity: SessionPopularityRow[]
}) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Attendee report</h2>
        <a href={`/api/admin/events/${event.id}/attendee-report/export`} className="btn-secondary btn">
          Export CSV
        </a>
      </div>

      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Estimated from how often each virtual attendee&rsquo;s livestream page pinged in — the event is one Vimeo
        livestream embed, not per-session video, so &ldquo;sessions attended&rdquo; is inferred by matching ping
        times against the session schedule, not measured directly.
      </p>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-box-value">{totals.activeCount}</div>
          <div className="stat-box-label">Active registrations</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-value">
            {totals.inPersonCount} / {totals.virtualCount}
          </div>
          <div className="stat-box-label">In-person / virtual</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-value">${totals.totalRevenue.toFixed(2)}</div>
          <div className="stat-box-label">Revenue (active)</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-value">{pct(totals.virtualEngagementRate)}</div>
          <div className="stat-box-label">Virtual attendees who opened the livestream</div>
        </div>
      </div>

      {sessionPopularity.length > 0 && (
        <>
          <h3>Session popularity</h3>
          <table style={{ marginBottom: 24 }}>
            <thead>
              <tr>
                <th>Session</th>
                <th>Est. unique attendees</th>
                <th>Total est. time</th>
                <th>Avg. est. time</th>
              </tr>
            </thead>
            <tbody>
              {sessionPopularity.map((s) => (
                <tr key={s.sessionId}>
                  <td>{s.sessionTitle}</td>
                  <td>{s.uniqueAttendees}</td>
                  <td>{formatMinutes(s.totalEstimatedMinutes)}</td>
                  <td>{formatMinutes(s.avgEstimatedMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3>Attendees</h3>
      {rows.length === 0 && <p className="muted">No one is registered for this event yet.</p>}
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Ticket type</th>
              <th>Attendance</th>
              <th>Status</th>
              <th>Paid</th>
              <th>Livestream time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.registrationId}>
                <tr style={{ opacity: r.status === 'cancelled' ? 0.55 : 1 }}>
                  <td>{r.attendeeName}</td>
                  <td>{r.attendeeEmail}</td>
                  <td>{r.ticketType}</td>
                  <td>{r.attendance}</td>
                  <td>{r.status}</td>
                  <td>${r.amountPaid.toFixed(2)}</td>
                  <td>{r.attendance === 'virtual' && r.totalPings > 0 ? formatMinutes(r.estimatedTotalMinutes) : '—'}</td>
                </tr>
                {r.sessionsAttended.length > 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '0 0 10px' }}>
                      <details>
                        <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>
                          Likely watched {r.sessionsAttended.length} session{r.sessionsAttended.length === 1 ? '' : 's'}
                        </summary>
                        <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13 }}>
                          {r.sessionsAttended.map((s) => (
                            <li key={s.sessionId}>
                              {s.sessionTitle} — {formatMinutes(s.estimatedMinutes)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
