'use client'

import React, { useState } from 'react'

export function RunUsptoImportButton() {
  const [issueDate, setIssueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleClick() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/trademark-reports/run-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(issueDate.trim() ? { issueDate: issueDate.trim() } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed.')

      if (data.skipped) {
        setResult(`Issue ${data.issueDate} was already imported successfully — nothing to do.`)
      } else if (data.run?.status === 'failed') {
        setResult(`Failed: ${data.run.error}`)
      } else {
        const c = data.run?.counts
        setResult(
          `Issue ${data.issueDate}: ${c?.new ?? 0} new, ${c?.updated ?? 0} updated ` +
            `(published ${c?.published ?? 0}, registered ${c?.registered ?? 0}, renewed ${c?.renewals ?? 0}, cancelled ${c?.cancellations ?? 0}). ` +
            `Images: ${c?.imagesSaved ?? 0} saved, ${c?.imagesMissing ?? 0} missing. ` +
            `Draft issues created: ${data.run?.issuesCreated?.length ?? 0}.` +
            (data.run?.error ? ` Report error: ${data.run.error}` : ''),
        )
      }
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="field">
        <label>Issue date (optional — YYYYMMDD, forces one specific issue)</label>
        <input
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
          placeholder="e.g. 20261013"
        />
      </div>
      <button className="btn" onClick={handleClick} disabled={busy}>
        {busy ? 'Importing… this can take a few minutes' : 'Run live USPTO import'}
      </button>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </div>
  )
}
