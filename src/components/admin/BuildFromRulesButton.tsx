'use client'

import { useDocumentInfo, useForm, useFormFields } from '@payloadcms/ui'
import React, { useState } from 'react'

export function BuildFromRulesButton() {
  const { getData, reset, setModified, setProcessing } = useForm()
  const { savedDocumentData } = useDocumentInfo()
  const format = useFormFields(([fields]) => fields.format?.value)
  const sending = (savedDocumentData as { email?: { status?: string } } | undefined)?.email?.status === 'sending'
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  if (format !== 'excerpt-list') return null

  async function handleClick() {
    const current = getData()
    const input = { publication: current.publication, issueDate: current.issueDate, format: current.format }
    setBusy(true); setProcessing(true); setMessage(null)
    try {
      const res = await fetch('/api/publication-issues/build-from-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to build from rules.')
      const latest = getData()
      if (JSON.stringify({ publication: latest.publication, issueDate: latest.issueDate, format: latest.format }) !== JSON.stringify(input))
        throw new Error('The publication, date or format changed. Build again using the current selection.')
      await reset({ ...latest, sections: data.sections })
      setModified(true)
      setMessage(`Built ${data.sectionCount} section(s), ${data.itemCount} item(s). Review the sections and save your draft.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to build from rules.')
    } finally { setBusy(false); setProcessing(false) }
  }
  return <div className="nic-issue-build">
    <button type="button" onClick={handleClick} disabled={busy || sending}>
      {busy ? 'Building…' : 'Build from rules'}
    </button>
    <small>Uses the selected publication and issue date. Replaces the section list; save when ready.</small>
    {message && <p role="status">{message}</p>}
  </div>
}
