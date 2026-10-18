'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import Link from 'next/link'

import type { Event, Speaker } from '@/payload-types'

export function SpeakersSection({ event, allSpeakers }: { event: Event; allSpeakers: Speaker[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [pickId, setPickId] = useState('')

  const attached = (event.speakers ?? []).filter((s): s is Speaker => typeof s === 'object')
  const attachedIds = new Set(attached.map((s) => s.id))
  const available = allSpeakers.filter((s) => !attachedIds.has(s.id))

  async function post(form: FormData) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/events/${event.id}/speakers`, { method: 'POST', body: form })
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
      <h2 style={{ marginTop: 0 }}>Speakers</h2>
      {error && <p style={{ color: '#9a3434' }}>{error}</p>}

      {attached.length === 0 && <p className="muted">No speakers attached yet.</p>}
      {attached.map((s) => (
        <div
          key={s.id}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--nrc-border)' }}
        >
          <span style={{ flex: 1 }}>
            <Link href={`/admin/collections/speakers/${s.id}`} aria-label={`Edit speaker ${s.name}`}>{s.name}</Link>
            {(s.role || s.company) && (
              <span className="muted"> — {[s.role, s.company].filter(Boolean).join(', ')}</span>
            )}
          </span>
          <button
            type="button"
            className="btn-secondary btn"
            disabled={busy}
            onClick={() => {
              const form = new FormData()
              form.set('action', 'detach')
              form.set('speakerId', String(s.id))
              post(form)
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <p className="muted">Speaker profiles are shared across events. Editing a profile updates it wherever it appears.</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <select value={pickId} onChange={(e) => setPickId(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
          <option value="">Add existing speaker…</option>
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
            form.set('speakerId', pickId)
            post(form)
          }}
        >
          Add
        </button>
        <button type="button" className="btn-secondary btn" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'Create new speaker'}
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
            <label>Name</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>Role</label>
            <input name="role" placeholder="VP, Regulatory Affairs" />
          </div>
          <div className="field">
            <label>Company</label>
            <input name="company" />
          </div>
          <div className="field">
            <label>Bio</label>
            <textarea name="bio" rows={3} />
          </div>
          <div className="field">
            <label>Headshot (optional)</label>
            <input name="headshot" type="file" accept="image/*" />
          </div>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Creating…' : 'Create and add to event'}
          </button>
        </form>
      )}
    </div>
  )
}
