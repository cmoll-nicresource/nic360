'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import type { Event, EventRegistration } from '@/payload-types'
import type { SimpleUser } from './types'

export function AttendeesSection({
  event,
  registrations,
  allUsers,
}: {
  event: Event
  registrations: EventRegistration[]
  allUsers: SimpleUser[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'none' | 'existing' | 'new'>('none')

  const ticketTypeNames = (event.ticketTypes ?? []).map((t) => t.name).filter(Boolean)

  async function submitAction(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/events/${event.id}/attendees`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed.')
      setMode('none')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Attendees</h2>
      {error && <p style={{ color: '#9a3434' }}>{error}</p>}

      {registrations.length === 0 && <p className="muted">No one is registered for this event yet.</p>}
      {registrations.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 0',
            borderBottom: '1px solid var(--nrc-border)',
            opacity: r.status === 'cancelled' ? 0.5 : 1,
          }}
        >
          <span style={{ flex: 1 }}>
            {r.attendeeName} <span className="muted">({r.attendeeEmail})</span> — {r.ticketType}, {r.attendance}
            {r.status === 'cancelled' ? ' · cancelled' : ''}
          </span>
          {r.status === 'active' && (
            <button
              type="button"
              className="btn-secondary btn"
              disabled={busy}
              onClick={() => submitAction({ action: 'cancel', registrationId: r.id })}
            >
              Cancel
            </button>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" className="btn" onClick={() => setMode(mode === 'existing' ? 'none' : 'existing')}>
          {mode === 'existing' ? 'Cancel' : 'Add existing user'}
        </button>
        <button type="button" className="btn-secondary btn" onClick={() => setMode(mode === 'new' ? 'none' : 'new')}>
          {mode === 'new' ? 'Cancel' : 'Register new user'}
        </button>
      </div>

      {mode === 'existing' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            submitAction({
              action: 'add-existing',
              userId: Number(form.get('userId')),
              ticketTypeName: form.get('ticketTypeName'),
              attendance: form.get('attendance'),
            })
          }}
          style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--nrc-border)' }}
        >
          <div className="field">
            <label>User</label>
            <select name="userId" required defaultValue="">
              <option value="" disabled>
                Choose a user…
              </option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <TicketAndAttendanceFields ticketTypeNames={ticketTypeNames} />
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Adding…' : 'Add as attendee'}
          </button>
        </form>
      )}

      {mode === 'new' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            submitAction({
              action: 'add-new',
              name: form.get('name'),
              email: form.get('email'),
              ticketTypeName: form.get('ticketTypeName'),
              attendance: form.get('attendance'),
            })
          }}
          style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--nrc-border)' }}
        >
          <div className="field">
            <label>Name</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" required />
          </div>
          <TicketAndAttendanceFields ticketTypeNames={ticketTypeNames} />
          <p className="muted" style={{ fontSize: 12 }}>
            Creates an account (if one doesn&apos;t exist for this email) and emails them a link to set a password.
          </p>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Registering…' : 'Register attendee'}
          </button>
        </form>
      )}
    </div>
  )
}

function TicketAndAttendanceFields({ ticketTypeNames }: { ticketTypeNames: string[] }) {
  return (
    <>
      <div className="field">
        <label>Ticket type</label>
        <select name="ticketTypeName" required defaultValue="">
          <option value="" disabled>
            {ticketTypeNames.length ? 'Choose a ticket type…' : 'This event has no ticket types yet.'}
          </option>
          {ticketTypeNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Attendance</label>
        <select name="attendance" required defaultValue="in-person">
          <option value="in-person">In person</option>
          <option value="virtual">Virtual</option>
        </select>
      </div>
    </>
  )
}
