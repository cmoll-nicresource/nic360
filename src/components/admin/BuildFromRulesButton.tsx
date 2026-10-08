'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useState } from 'react'

export function BuildFromRulesButton() {
  const { id, savedDocumentData } = useDocumentInfo()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!id) return null
  if (savedDocumentData && 'format' in savedDocumentData && savedDocumentData.format !== 'excerpt-list') {
    return null
  }

  async function handleClick() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/publication-issues/${id}/build-from-rules`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed.')
      setMessage(`Built ${data.sectionCount} section(s), ${data.itemCount} item(s). Reloading…`)
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        style={{
          padding: '8px 14px',
          borderRadius: 4,
          background: 'var(--theme-elevation-800, #1a2330)',
          color: '#fff',
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? 'Building…' : 'Build from rules'}
      </button>
      {message && <p style={{ fontSize: 12, marginTop: 4 }}>{message}</p>}
    </div>
  )
}
