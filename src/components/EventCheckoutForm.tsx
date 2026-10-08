'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type TicketType = {
  name: string
  honorSystem?: boolean | null
  onSale?: boolean | null
  capacity?: number | null
  inPerson?: { price?: number | null; subscriberPrice?: number | null } | null
  virtual?: { price?: number | null; subscriberPrice?: number | null } | null
}

type Attendee = { name: string; email: string }

function priceFor(tt: TicketType, attendance: 'in-person' | 'virtual', isSubscriber: boolean): number | null {
  const bucket = attendance === 'in-person' ? tt.inPerson : tt.virtual
  if (!bucket || bucket.price == null) return null
  return isSubscriber ? (bucket.subscriberPrice ?? bucket.price) : bucket.price
}

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
  const onSaleTypes = ticketTypes.filter((t) => t.onSale !== false)
  const [ticketTypeName, setTicketTypeName] = useState(onSaleTypes[0]?.name ?? '')
  const [attendance, setAttendance] = useState<'in-person' | 'virtual'>('in-person')
  const [discountCode, setDiscountCode] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([{ name: buyerName, email: buyerEmail }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedType = onSaleTypes.find((t) => t.name === ticketTypeName)
  const unitPrice = selectedType ? priceFor(selectedType, attendance, isSubscriber) : null
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

  if (onSaleTypes.length === 0) {
    return <p className="muted">No ticket types are currently on sale for this event.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <label style={{ display: 'block', marginBottom: 8 }}>
        Ticket type
        <select value={ticketTypeName} onChange={(e) => setTicketTypeName(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
          {onSaleTypes.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
              {t.honorSystem ? ' (self-declared eligibility)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Attendance
        <select value={attendance} onChange={(e) => setAttendance(e.target.value as 'in-person' | 'virtual')} style={{ display: 'block', marginTop: 4 }}>
          <option value="in-person">In person</option>
          <option value="virtual">Virtual</option>
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
          : `${unitPrice === 0 ? 'Free' : `$${unitPrice.toFixed(2)}`} per ticket${isSubscriber ? ' (subscriber price)' : ''} · Estimated total: ${
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
