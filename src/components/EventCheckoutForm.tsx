'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { ticketUnitPrice } from '@/lib/eventCheckout'
import type { Event } from '@/payload-types'

type TicketType = NonNullable<Event['ticketTypes']>[number]

type Attendee = { name: string; email: string }


export function EventCheckoutForm({
  eventId,
  ticketTypes,
  isSubscriber,
  buyerName,
  buyerEmail,
}: {
  eventId: string
  ticketTypes: TicketType[]
  isSubscriber: boolean
  buyerName: string
  buyerEmail: string
}) {
  const router = useRouter()
  const [ticketTypeName, setTicketTypeName] = useState(ticketTypes[0]?.name ?? '')
  const [attendance, setAttendance] = useState<'in-person' | 'virtual'>(ticketTypes[0]?.inPerson?.price != null ? 'in-person' : 'virtual')
  const [discountCode, setDiscountCode] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([{ name: buyerName, email: buyerEmail }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedType = ticketTypes.find((t) => t.name === ticketTypeName)
  const unitPrice = selectedType ? ticketUnitPrice(selectedType, attendance, isSubscriber) : null
  const estimatedTotal = unitPrice != null ? unitPrice * attendees.length : null

  function updateAttendee(i: number, field: keyof Attendee, value: string) {
    setAttendees((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)))
  }

  function addAttendee() {
    setAttendees((prev) => [...prev, { name: '', email: '' }])
  }

  function removeAttendee(i: number) {
    setAttendees((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/events/${eventId}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ticketTypeName,
          attendance,
          attendees,
          discountCode: discountCode || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout failed.')
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else if (data.comped) {
        router.push(`/events/${eventId}/success?order=${data.orderId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.')
    } finally {
      setBusy(false)
    }
  }

  if (ticketTypes.length === 0) return <p className="muted">No ticket options are configured. Contact the event team for assistance.</p>

  return (
    <form onSubmit={handleSubmit} className="card">
      <label style={{ display: 'block', marginBottom: 8 }}>
        Ticket type
        <select value={ticketTypeName} onChange={(e) => {
          setTicketTypeName(e.target.value)
          const next = ticketTypes.find(t => t.name === e.target.value)
          if (next && ticketUnitPrice(next, attendance, isSubscriber) == null)
            setAttendance(next.inPerson?.price != null ? 'in-person' : 'virtual')
        }} style={{ display: 'block', marginTop: 4 }}>
          {ticketTypes.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Attendance
        <select value={attendance} onChange={(e) => setAttendance(e.target.value as 'in-person' | 'virtual')} style={{ display: 'block', marginTop: 4 }}>
          {selectedType?.inPerson?.price != null && <option value="in-person">In person</option>}
          {selectedType?.virtual?.price != null && <option value="virtual">Virtual</option>}
        </select>
      </label>

      <h3>Attendees</h3>
      {attendees.map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Name"
            value={a.name}
            onChange={(e) => updateAttendee(i, 'name', e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={a.email}
            onChange={(e) => updateAttendee(i, 'email', e.target.value)}
            required
          />
          {attendees.length > 1 && (
            <button type="button" onClick={() => removeAttendee(i)}>
              Remove
            </button>
          )}
        </div>
      ))}
      <p>
        <button type="button" onClick={addAttendee}>
          + Add a colleague
        </button>
      </p>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Discount code
        <input value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
      </label>

      <p className="excerpt-meta">
        {unitPrice == null
          ? 'Not available for this attendance mode.'
          : `${unitPrice === 0 ? 'Free' : `$${unitPrice.toFixed(2)}`} per ticket${isSubscriber ? ' (subscriber price)' : ' (non-subscriber price)'} · Estimated total: ${
              estimatedTotal === 0 ? 'Free' : `$${estimatedTotal?.toFixed(2)}`
            } before any discount code`}
      </p>

      {error && <p style={{ color: '#8a2b2b' }}>{error}</p>}

      <button type="submit" disabled={busy || unitPrice == null}>
        {busy ? 'Processing…' : 'Buy tickets'}
      </button>
    </form>
  )
}
