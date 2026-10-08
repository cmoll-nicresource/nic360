'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useState } from 'react'

export function SendIssueButtons() {
  const { id, savedDocumentData } = useDocumentInfo()
  const [busy, setBusy] = useState<'test' | 'send' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!id) return null

  const status =
    savedDocumentData && 'email' in savedDocumentData
      ? (savedDocumentData.email as { status?: string } | undefined)?.status
      : undefined
  const alreadySent = status === 'sent'

  async function send(test: boolean) {
    let testEmail: string | undefined
    if (test) {
      testEmail = window.prompt('Send a test to which email address?') ?? undefined
      if (!testEmail) return
    } else if (!window.confirm('Send this issue now? This cannot be undone once sent.')) {
      return
    }

    setBusy(test ? 'test' : 'send')
    setMessage(null)
    try {
      const res = await fetch(`/api/publication-issues/${id}/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ test, testEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed.')
      setMessage(
        test
          ? `Test sent to ${testEmail}. Check the Mailchimp outbox.`
          : `Sent! Campaign ${data.campaignId} targeted at: ${data.segmentLabel}. Reloading…`,
      )
      if (!test) setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => send(true)}
        disabled={busy !== null}
        style={{
          padding: '8px 14px',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-800, #1a2330)',
          background: 'transparent',
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy === 'test' ? 'Sending test…' : 'Send test'}
      </button>
      <button
        type="button"
        onClick={() => send(false)}
        disabled={busy !== null || alreadySent}
        title={alreadySent ? 'Already sent — locked against re-sending' : undefined}
        style={{
          padding: '8px 14px',
          borderRadius: 4,
          border: 'none',
          background: alreadySent ? 'var(--theme-elevation-200, #ccc)' : 'var(--theme-success-500, #1f6f5c)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: busy || alreadySent ? 'default' : 'pointer',
        }}
      >
        {alreadySent ? 'Already sent' : busy === 'send' ? 'Sending…' : 'Send'}
      </button>
      {message && <span style={{ fontSize: 12 }}>{message}</span>}
    </div>
  )
}
