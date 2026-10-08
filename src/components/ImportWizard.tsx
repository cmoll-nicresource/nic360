'use client'

import React, { useState } from 'react'

type Column = { key?: string | null; label: string }

type PreviewResponse = {
  token: string
  headers: string[]
  sampleRows: Record<string, string>[]
  totalRows: number
  suggestedMapping: Record<string, string | null>
  columns: Column[]
}

type ConfirmResponse = { rowCount: number; unmatchedCountries: string[] }

export function ImportWizard({ datasetId, datasetSlug }: { datasetId: string; datasetSlug: string }) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'done'>('upload')
  const [replace, setReplace] = useState(true)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [mapping, setMapping] = useState<Record<string, string | null>>({})
  const [result, setResult] = useState<ConfirmResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/datasets/${datasetId}/import-preview`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed.')
      setPreview(data)
      setMapping(data.suggestedMapping)
      setStep('mapping')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/datasets/${datasetId}/import-confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: preview.token, mapping, replace }),
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

  if (step === 'upload') {
    return (
      <form onSubmit={handleUpload} className="card">
        <p>
          <label>
            <input type="file" name="file" accept=".csv,text/csv" required />
          </label>
        </p>
        <p>
          <label>
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />{' '}
            Replace existing rows
          </label>
        </p>
        {error && <p style={{ color: '#8a2b2b' }}>{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Reading file…' : 'Preview'}
        </button>
      </form>
    )
  }

  if (step === 'mapping' && preview) {
    return (
      <div className="card">
        <p className="muted">
          Found {preview.totalRows} row(s) and {preview.headers.length} column(s). Map each
          spreadsheet header to a dataset column (or leave it unmapped to ignore it).
        </p>
        <table>
          <thead>
            <tr>
              <th>Spreadsheet header</th>
              <th>Maps to</th>
              <th>Sample value</th>
            </tr>
          </thead>
          <tbody>
            {preview.headers.map((header) => (
              <tr key={header}>
                <td>{header}</td>
                <td>
                  <select
                    value={mapping[header] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [header]: e.target.value || null }))
                    }
                  >
                    <option value="">(ignore)</option>
                    {preview.columns.map((c) => (
                      <option key={c.key} value={c.key ?? ''}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="muted">{preview.sampleRows[0]?.[header] ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Preview (first {preview.sampleRows.length} rows)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                {preview.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row, i) => (
                <tr key={i}>
                  {preview.headers.map((h) => (
                    <td key={h}>{row[h]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p style={{ color: '#8a2b2b' }}>{error}</p>}
        <p>
          <button type="button" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Importing…' : replace ? 'Replace existing rows and import' : 'Import (append)'}
          </button>{' '}
          <button type="button" onClick={() => setStep('upload')} disabled={busy}>
            Start over
          </button>
        </p>
      </div>
    )
  }

  if (step === 'done' && result) {
    return (
      <div className="card">
        <p>
          Imported <strong>{result.rowCount}</strong> row(s).
        </p>
        {result.unmatchedCountries.length > 0 && (
          <p style={{ color: '#8a6d1f' }}>
            Unmatched country values (stored as-is): {result.unmatchedCountries.join(', ')}
          </p>
        )}
        <p>
          <a href={`/datasets/${datasetSlug}`}>View the dataset →</a>
        </p>
      </div>
    )
  }

  return null
}
