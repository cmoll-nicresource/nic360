'use client'

import React, { useState } from 'react'

type Issue = { kind: string; detail?: string; rowCount?: number }
type LoadResult = { flow: 'import' | 'export'; yr: number; mo: number; rows: number; replaced: number; ytdCheck: string | null; issues: Issue[] }
type FilePreview = { token: string; fileName: string; preview: { result: LoadResult | null; error: string | null; wouldReplace: boolean } } | null
type PreviewResponse = { import: FilePreview; export: FilePreview }
type ConfirmResponse = { runId: number; status: 'succeeded' | 'failed'; loaded: LoadResult[]; issuesCreated: number[]; error?: string }

function LoadSummary({ fp }: { fp: FilePreview }) {
  if (!fp) return null
  const { fileName, preview } = fp
  if (preview.error) {
    return (
      <p style={{ color: '#8a2b2b' }}>
        <strong>{fileName}:</strong> {preview.error}
      </p>
    )
  }
  if (!preview.result) return null
  const r = preview.result
  return (
    <div style={{ marginBottom: 8 }}>
      <p>
        <strong>{fileName}</strong> — {r.flow} {r.yr}-{String(r.mo).padStart(2, '0')}: {r.rows} row(s)
        {preview.wouldReplace ? <span style={{ color: '#8a6d1f' }}> (will replace {r.replaced} existing row(s))</span> : null}
      </p>
      {r.ytdCheck && <p className="muted" style={{ fontSize: 13 }}>{r.ytdCheck}</p>}
      {r.issues.map((issue, i) => (
        <p key={i} className="muted" style={{ fontSize: 13 }}>
          {issue.kind}
          {issue.detail ? `: ${issue.detail}` : ''}
        </p>
      ))}
    </div>
  )
}

export function TradeImportWizard() {
  const [step, setStep] = useState<'upload' | 'confirm' | 'done'>('upload')
  const [year, setYear] = useState('')
  const [inputsJson, setInputsJson] = useState('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<ConfirmResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/trade-reports/import-preview', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed.')
      setPreview(data)
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setError(null)
    setBusy(true)
    try {
      let inputs: unknown
      if (inputsJson.trim()) {
        try {
          inputs = JSON.parse(inputsJson)
        } catch {
          throw new Error('Inputs is not valid JSON.')
        }
      }
      const res = await fetch('/api/trade-reports/import-confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          importToken: preview.import?.token,
          exportToken: preview.export?.token,
          year: year.trim() ? Number(year) : undefined,
          inputs,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed.')
      setResult(data)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  function startOver() {
    setStep('upload')
    setPreview(null)
    setResult(null)
    setError(null)
  }

  if (step === 'upload') {
    return (
      <form onSubmit={handleUpload} className="card">
        <div className="field">
          <label>Import file (Imp_MMYYYY.xls)</label>
          <input type="file" name="importFile" accept=".xls,.xlsx" />
        </div>
        <div className="field">
          <label>Export file (Exp_MMYYYY.xls)</label>
          <input type="file" name="exportFile" accept=".xls,.xlsx" />
        </div>
        <div className="field">
          <label>Year override (optional)</label>
          <input type="number" name="year" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Only if the file name's year is wrong" />
        </div>
        {error && <p style={{ color: '#8a2b2b' }}>{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Reading file(s)…' : 'Preview'}
        </button>
      </form>
    )
  }

  if (step === 'confirm' && preview) {
    const hasError = Boolean(preview.import?.preview.error || preview.export?.preview.error)
    return (
      <div className="card">
        <h3>What this will do</h3>
        <LoadSummary fp={preview.import} />
        <LoadSummary fp={preview.export} />

        <div className="field">
          <label>Report inputs (optional JSON — total US trade, TRQ usage, commentary)</label>
          <textarea
            value={inputsJson}
            onChange={(e) => setInputsJson(e.target.value)}
            rows={6}
            placeholder='{"released": "...", "usTrade": {...}, "commentary": {...}, "trq": {...}}'
          />
          <p className="muted" style={{ fontSize: 13 }}>
            Left blank, the report highlights these figures as placeholders for you to fill in by hand afterward.
          </p>
        </div>

        {error && <p style={{ color: '#8a2b2b' }}>{error}</p>}
        <p>
          <button type="button" onClick={handleConfirm} disabled={busy || hasError}>
            {busy ? 'Loading and generating report…' : 'Confirm: load data and generate report'}
          </button>{' '}
          <button type="button" onClick={startOver} disabled={busy}>
            Start over
          </button>
        </p>
      </div>
    )
  }

  if (step === 'done' && result) {
    return (
      <div className="card">
        {result.status === 'succeeded' ? (
          <>
            <p>Done. {result.loaded.map((r) => `${r.flow} ${r.yr}-${String(r.mo).padStart(2, '0')}: ${r.rows} rows`).join('; ')}</p>
            {result.issuesCreated.length > 0 ? (
              <p>
                Draft issue created — review it in{' '}
                <a href="/admin/collections/publication-issues" target="_blank" rel="noreferrer">
                  the admin
                </a>{' '}
                before sending.
              </p>
            ) : (
              <p className="muted">No report issue was created — check trade-import-runs for why.</p>
            )}
          </>
        ) : (
          <p style={{ color: '#8a2b2b' }}>Failed: {result.error}</p>
        )}
        <p>
          <button type="button" onClick={startOver}>
            Load another month
          </button>
        </p>
      </div>
    )
  }

  return null
}
