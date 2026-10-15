'use client'

import { useState } from 'react'
import Link from 'next/link'

export function GenerateTrademarkReport() {
  const [kind, setKind] = useState('weekly')
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 7)
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [issues, setIssues] = useState<number[]>([])
  return (
    <form
      className="card"
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        setMessage('')
        setIssues([])
        try {
          const response = await fetch('/api/trademark-reports/generate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind, period: kind === 'monthly' ? month : day }),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Generation failed.')
          setIssues(result.issuesCreated)
          setMessage(
            result.issuesCreated.length
              ? 'PDF attached to a new draft issue. Open the draft to review it.'
              : 'No matching activity for this period. No draft was created.',
          )
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Generation failed.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <h2>Generate a report</h2>
      <p>
        Use records already in the CMS to create a fresh PDF draft. Import the Gazette first when
        you need new records.
      </p>
      <div className="field">
        <label htmlFor="trademark-report-kind">Report</label>
        <select
          id="trademark-report-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          disabled={busy}
        >
          <option value="weekly">Weekly - published for opposition</option>
          <option value="monthly">Monthly - publications, cancellations and renewals</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="trademark-report-period">
          {kind === 'monthly' ? 'Reporting month' : 'Week ending (seven days, inclusive)'}
        </label>
        <input
          id="trademark-report-period"
          required
          type={kind === 'monthly' ? 'month' : 'date'}
          value={kind === 'monthly' ? month : day}
          onChange={(event) =>
            kind === 'monthly' ? setMonth(event.target.value) : setDay(event.target.value)
          }
          disabled={busy}
        />
      </div>
      {kind === 'monthly' && (
        <p>
          Includes marks published for opposition, cancellations and renewals. Every Tuesday Gazette
          issue in the reporting month must be imported successfully before generation.
        </p>
      )}
      <button className="btn" disabled={busy} type="submit">
        {busy ? 'Generating PDF...' : 'Generate draft PDF'}
      </button>
      <div role="status" aria-live="polite">
        {message && <p>{message}</p>}
        {issues.map((id) => (
          <p key={id}>
            <Link href={`/admin/collections/publication-issues/${id}`}>Review draft issue →</Link>
          </p>
        ))}
      </div>
    </form>
  )
}
