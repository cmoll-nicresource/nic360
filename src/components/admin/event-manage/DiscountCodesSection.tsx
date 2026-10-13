'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import type { DiscountCode, Event } from '@/payload-types'
import type { SimpleAccessProvider } from './types'

export function DiscountCodesSection({
  event,
  discountCodes,
  accessProviders,
}: {
  event: Event
  discountCodes: DiscountCode[]
  accessProviders: SimpleAccessProvider[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const ticketTypeNames = (event.ticketTypes ?? []).map((t) => t.name).filter(Boolean)

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Discount codes</h2>
      {error && <p style={{ color: '#9a3434' }}>{error}</p>}

      {discountCodes.length === 0 && <p className="muted">No discount codes for this event yet.</p>}
      {discountCodes.map((d) => {
        const used = d.uses?.totalDocs ?? 0
        const providerName =
          d.accessProvider && typeof d.accessProvider === 'object' ? d.accessProvider.name : null
        return (
          <div key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--nrc-border)' }}>
            <strong>{d.code}</strong> — {d.percentOff}% off, {used}/{d.maxUses} used
            {providerName ? ` · ${providerName}` : ''}
            {d.expiresAt ? ` · expires ${new Date(d.expiresAt).toLocaleDateString()}` : ''}
          </div>
        )
      })}

      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'Create discount code'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            const ticketTypeNamesSelected = form.getAll('ticketTypeNames')

            setBusy(true)
            setError(null)
            try {
              const res = await fetch(`/api/admin/events/${event.id}/discount-codes`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  code: form.get('code'),
                  accessProviderId: form.get('accessProviderId') || undefined,
                  percentOff: Number(form.get('percentOff')),
                  maxUses: Number(form.get('maxUses')),
                  ticketTypeNames: ticketTypeNamesSelected.length ? ticketTypeNamesSelected : undefined,
                  expiresAt: form.get('expiresAt') || undefined,
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
            <label>Code</label>
            <input name="code" required style={{ textTransform: 'uppercase' }} />
          </div>
          <div className="field">
            <label>Access provider (optional)</label>
            <select name="accessProviderId" defaultValue="">
              <option value="">None</option>
              {accessProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Percent off</label>
              <input name="percentOff" type="number" min={1} max={100} required defaultValue={100} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Max uses</label>
              <input name="maxUses" type="number" min={1} required defaultValue={1} />
            </div>
          </div>
          <div className="field">
            <label>Expires (optional)</label>
            <input name="expiresAt" type="date" />
          </div>
          {ticketTypeNames.length > 0 && (
            <div className="field">
              <label>Limit to ticket type(s) (leave unchecked for all)</label>
              {ticketTypeNames.map((name) => (
                <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" name="ticketTypeNames" value={name} />
                  {name}
                </label>
              ))}
            </div>
          )}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Creating…' : 'Create discount code'}
          </button>
        </form>
      )}
    </div>
  )
}
