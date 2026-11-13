'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import Link from 'next/link'

import type { Event, Session } from '@/payload-types'
import { clockFromInput, formatClockRange } from '@/lib/sessionTime'

const SESSION_TYPES = ['Keynote', 'Panel', 'Break', 'Other'] as const

function dayLabel(date: string, name?: string | null) {
  const formatted = new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return name ? `${formatted} — ${name}` : formatted
}


export function SessionsSection({ event, sessions, totalCount }: { event: Event; sessions: Session[]; totalCount: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const days = event.days ?? []

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Sessions</h2>
      {error && <p style={{ color: '#9a3434' }}>{error}</p>}

      {sessions.length === 0 && <p className="muted">No sessions yet.</p>}
      {sessions.map((s) => {
        const day = days.find((d) => d.date === s.day)
        return (
          <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--nrc-border)' }}>
            <strong><Link href={`/admin/collections/sessions/${s.id}`} aria-label={`Edit session ${s.title}`}>{s.title}</Link></strong>{' '}
            <span className="muted">
              — {day ? dayLabel(day.date, day.name) : new Date(s.day).toLocaleDateString()} · {s.type}
              {s.startTime ? ` · ${formatClockRange(s.startTime, s.endTime)}` : ''}
              {s.room ? ` · ${s.room}` : ''}
            </span>
          </div>
        )
      })}
      <p><Link href={`/admin/collections/sessions?where[event][equals]=${event.id}`}>Browse all {totalCount} agenda sessions</Link></p>

      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'Add session'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            const day = String(form.get('day') || '')
            const startTime = clockFromInput(String(form.get('startTime') || '')) ?? undefined
            const endTime = clockFromInput(String(form.get('endTime') || '')) ?? undefined

            setBusy(true)
            setError(null)
            try {
              const res = await fetch(`/api/admin/events/${event.id}/sessions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  title: form.get('title'),
                  description: form.get('description'),
                  day,
                  startTime,
                  endTime,
                  type: form.get('type'),
                  room: form.get('room'),
                }),
              })
              const data = await res.json()
              if (!res.ok) throw new Error(data.error || 'Request failed.')
              setShowCreate(false)
              router.refresh()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Something went wrong.')
            } finally {
              setBusy(false)
            }
          }}
          style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--nrc-border)' }}
        >
          <div className="field">
            <label>Title</label>
            <input name="title" required />
          </div>
          <div className="field">
            <label>Day</label>
            <select name="day" required defaultValue="">
              <option value="" disabled>
                {days.length ? 'Choose a day…' : "This event has no days yet — set start/end dates first."}
              </option>
              {days.map((d) => (
                <option key={d.date} value={d.date}>
                  {dayLabel(d.date, d.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Session type</label>
            <select name="type" required defaultValue="Panel">
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Start time (venue clock)</label>
            <input name="startTime" type="time" />
          </div>
          <div className="field">
            <label>End time (venue clock)</label>
            <input name="endTime" type="time" />
          </div>
          <div className="field">
            <label>Room</label>
            <input name="room" placeholder="Main Hall" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea name="description" rows={2} />
          </div>
          <button type="submit" className="btn" disabled={busy || days.length === 0}>
            {busy ? 'Adding…' : 'Add session'}
          </button>
        </form>
      )}
    </div>
  )
}
