'use client'

import React, { useState } from 'react'

export function RunTrademarkReportButton() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleClick() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/trademark-reports/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed.')
      setResult(
        `Status: ${data.status}. New: ${data.counts?.new ?? 0}, updated: ${data.counts?.updated ?? 0}, ` +
          `renewals: ${data.counts?.renewals ?? 0}, cancellations: ${data.counts?.cancellations ?? 0}. ` +
          `Draft issues created: ${data.issuesCreated?.length ?? 0}.`,
      )
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <button onClick={handleClick} disabled={busy}>
        {busy ? 'Running…' : 'Run now'}
      </button>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </div>
  )
}
