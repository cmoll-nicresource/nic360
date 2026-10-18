'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import type { Event } from '@/payload-types'

type TicketType = NonNullable<Event['ticketTypes']>[number]

const BLANK: TicketType = {
  name: '',
  capacity: null,
  inPerson: { price: null, subscriberPrice: null },
  virtual: { price: null, subscriberPrice: null },
}

function numOrNull(v: string): number | null {
  if (v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function TicketTypesSection({ event }: { event: Event }) {
  const router = useRouter()
  const [rows, setRows] = useState<TicketType[]>(event.ticketTypes ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(i: number, patch: Partial<TicketType>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/events/${event.id}/ticket-types`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticketTypes: rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Ticket types</h2>
      <p className="muted">Tickets are always available for registration. Set non-subscriber and subscriber prices for each attendance option. A blank subscriber price uses the non-subscriber price.</p>
      {error && <p style={{ color: '#9a3434' }}>{error}</p>}

      {rows.length === 0 && <p className="muted">No ticket types yet.</p>}
      {rows.map((t, i) => (
        <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--nrc-border)' }}>
          <div className="field">
            <label>Name</label>
            <input value={t.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="General Admission" />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              Capacity
              <input
                type="number"
                style={{ width: 90 }}
                value={t.capacity ?? ''}
                onChange={(e) => update(i, { capacity: numOrNull(e.target.value) })}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                In-person (blank = no option)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  placeholder="Non-subscriber price" aria-label="Non-subscriber price" min="0" step="0.01"
                  style={{ width: 150 }}
                  value={t.inPerson?.price ?? ''}
                  onChange={(e) => update(i, { inPerson: { ...t.inPerson, price: numOrNull(e.target.value) } })}
                />
                <input
                  type="number"
                  placeholder="Subscriber price" aria-label="Subscriber price" min="0" step="0.01"
                  style={{ width: 120 }}
                  value={t.inPerson?.subscriberPrice ?? ''}
                  onChange={(e) =>
                    update(i, { inPerson: { ...t.inPerson, subscriberPrice: numOrNull(e.target.value) } })
                  }
                />
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Virtual
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  placeholder="Non-subscriber price" aria-label="Non-subscriber price" min="0" step="0.01"
                  style={{ width: 150 }}
                  value={t.virtual?.price ?? ''}
                  onChange={(e) => update(i, { virtual: { ...t.virtual, price: numOrNull(e.target.value) } })}
                />
                <input
                  type="number"
                  placeholder="Subscriber price" aria-label="Subscriber price" min="0" step="0.01"
                  style={{ width: 120 }}
                  value={t.virtual?.subscriberPrice ?? ''}
                  onChange={(e) =>
                    update(i, { virtual: { ...t.virtual, subscriberPrice: numOrNull(e.target.value) } })
                  }
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary btn"
            style={{ marginTop: 10 }}
            onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
          >
            Remove ticket type
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" className="btn-secondary btn" onClick={() => setRows((r) => [...r, { ...BLANK }])}>
          Add ticket type
        </button>
        <button type="button" className="btn" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save ticket types'}
        </button>
      </div>
    </div>
  )
}
