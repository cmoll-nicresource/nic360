'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useState } from 'react'

export function ReAddButton() {
  const { id, savedDocumentData } = useDocumentInfo()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!id) return null
  const status = savedDocumentData && 'status' in savedDocumentData ? savedDocumentData.status : undefined
  if (status === 'resolved') return null

  async function handleClick() {
    if (
      !window.confirm(
        'Have you already deleted this contact in Mailchimp by hand? Re-add restores their publication choices and re-syncs.',
      )
    ) {
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/email-flags/${id}/re-add`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed.')
      setMessage(`Restored ${data.restored} publication(s). Reloading…`)
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
          background: 'var(--theme-success-500, #1f6f5c)',
          color: '#fff',
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? 'Re-adding…' : 'Re-add'}
      </button>
      {message && <p style={{ fontSize: 12, marginTop: 4 }}>{message}</p>}
    </div>
  )
}
