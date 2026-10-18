'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import Link from 'next/link'

import type { Event, Sponsor } from '@/payload-types'

export function SponsorsSection({ event, allSponsors }: { event: Event; allSponsors: Sponsor[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [pickId, setPickId] = useState('')

  const attached = (event.sponsors ?? []).filter((s): s is Sponsor => typeof s === 'object')
  const attachedIds = new Set(attached.map((s) => s.id))
  const available = allSponsors.filter((s) => !attachedIds.has(s.id))

  async function post(form: FormData) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/events/${event.id}/sponsors`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed.')
      setShowCreate(false)
      setPickId('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Sponsors</h2>
      {error && <p style={{ color: '#9a3434' }}>{error}</p>}

      {attached.length === 0 && <p className="muted">No sponsors attached yet.</p>}
      {attached.map((s) => (
        <div
          key={s.id}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--nrc-border)' }}
        >
          <span style={{ flex: 1 }}><Link href={`/admin/collections/sponsors/${s.id}`} aria-label={`Edit sponsor ${s.name}`}>{s.name}</Link></span>
          <button
            type="button"
            className="btn-secondary btn"
            disabled={busy}
            onClick={() => {
              const form = new FormData()
              form.set('action', 'detach')
              form.set('sponsorId', String(s.id))
              post(form)
            }}
          >
            Remove
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <select value={pickId} onChange={(e) => setPickId(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
          <option value="">Add existing sponsor…</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          disabled={busy || !pickId}
          onClick={() => {
            const form = new FormData()
            form.set('action', 'attach')
            form.set('sponsorId', pickId)
            post(form)
          }}
        >
          Add
        </button>
        <button type="button" className="btn-secondary btn" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'Create new sponsor'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            form.set('action', 'create')
            post(form)
          }}
          style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--nrc-border)' }}
        >
          <div className="field">
            <label>Company name</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>Website</label>
            <input name="website" placeholder="https://" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea name="description" required rows={3} />
          </div>
          <div className="field">
            <label>Logo</label>
            <input name="logo" type="file" accept="image/*" required />
          </div>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Creating…' : 'Create and add to event'}
          </button>
        </form>
      )}
    </div>
  )
}
