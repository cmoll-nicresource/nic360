'use client'
import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { previousResearchMonth } from '@/lib/research/period'
// Preserve the first selection by keeping server-rendered controls disabled until hydration.
const subscribeToReadiness = () => () => {}
export function GenerateResearchDigest() {
  const ready = useSyncExternalStore(subscribeToReadiness, () => true, () => false)
  const [month, setMonth] = useState(() => previousResearchMonth())
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [issue, setIssue] = useState<number | null>(null)
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        setIssue(null)
        try {
          const response = await fetch('/api/admin/research-reports', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ month }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || 'Generation failed.')
          setIssue(data.issueId)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Generation failed.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <h2>Generate a digest</h2>
      <p>
        Includes published research dated within the selected calendar month.
        Articles are grouped by journal, with linked contents, authors, bodies,
        dates and DOI links. Review research drafts before publishing them.
      </p>
      <p>
        Generating again updates this month’s unsent draft. Published or sent
        digests are protected.
      </p>
      <div className="field">
        <label htmlFor="research-month">Research month</label>
        <input
          id="research-month"
          type="month"
          value={month}
          required
          disabled={!ready || busy}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      <button className="btn" disabled={!ready || busy}>
        {busy ? 'Generating…' : 'Generate draft PDF'}
      </button>
      {error && <p role="alert">{error}</p>}
      {issue && (
        <p role="status">
          PDF ready.{' '}
          <Link href={`/admin/collections/publication-issues/${issue}`}>
            Review draft issue ↗
          </Link>
        </p>
      )}
    </form>
  )
}
