'use client'

import React, { useState } from 'react'

type Publication = { id: number; title: string; description?: string | null }

export function PublicationPreferencesForm({
  userId,
  publications,
  initialSelectedIds,
}: {
  userId: number
  publications: Publication[]
  initialSelectedIds: number[]
}) {
  const [selected, setSelected] = useState(new Set(initialSelectedIds))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emailPublications: [...selected] }),
      })
      if (!res.ok) throw new Error('Failed to save.')
      setMessage('Saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {publications.map((pub) => (
        <label key={pub.id} style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={selected.has(pub.id)} onChange={() => toggle(pub.id)} /> {pub.title}
          {pub.description && <span className="muted"> — {pub.description}</span>}
        </label>
      ))}
      {publications.length === 0 && <p className="muted">No publications available yet.</p>}
      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
      {message && <span style={{ marginLeft: 8 }}>{message}</span>}
    </div>
  )
}
