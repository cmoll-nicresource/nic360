'use client'

import { useDocumentInfo, useForm } from '@payloadcms/ui'
import { useState } from 'react'

type Preview = { html: string; subject: string; previewText: string; pdfUrl: string | null }

export function IssuePreview() {
  const { getData } = useForm()
  const { id } = useDocumentInfo()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mobile, setMobile] = useState(false)
  const [view, setView] = useState<'email' | 'pdf'>('email')
  async function refresh() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/publication-issues/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getData(), ...(id ? { id: Number(id) } : {}) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Preview failed.')
      setPreview(data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Preview failed.')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="nic-issue-preview" aria-label="Publication preview">
      <div className="nic-issue-preview__toolbar">
        <button type="button" onClick={refresh} disabled={busy}>
          {busy ? 'Rendering…' : preview ? 'Refresh preview' : 'Preview issue'}
        </button>
        {preview && (
          <>
            <button type="button" onClick={() => setPreview(null)}>
              Close preview
            </button>
            <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}>
              Desktop
            </button>
            <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}>
              Mobile
            </button>
            {preview.pdfUrl && (
              <>
                <button
                  type="button"
                  aria-pressed={view === 'email'}
                  onClick={() => setView('email')}
                >
                  Email
                </button>
                <button type="button" aria-pressed={view === 'pdf'} onClick={() => setView('pdf')}>
                  Attached PDF
                </button>
              </>
            )}
          </>
        )}
      </div>
      <small>
        Includes unsaved edits at the time you click preview. Refresh after making changes. No email
        is sent. Links are disabled.
      </small>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <>
          <p>
            <strong>Subject:</strong> {preview.subject}
            <br />
            <strong>Preview text:</strong> {preview.previewText || '(none)'}
          </p>
          <div className="nic-issue-preview__canvas" style={{ maxWidth: mobile ? 390 : '100%' }}>
            {view === 'pdf' && preview.pdfUrl ? (
              <iframe title="Attached report PDF" src={preview.pdfUrl} />
            ) : (
              <iframe
                title="Publication email preview"
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={preview.html.replace(
                  /<head>/i,
                  '<head><style>a{pointer-events:none!important;cursor:default!important}</style>',
                )}
              />
            )}
          </div>
        </>
      )}
    </section>
  )
}
