'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useState } from 'react'

/**
 * Shows the copied article text on a story (it is edited on Tobacco Reporter,
 * not here) and offers a refresh. The text was sanitized when it was copied.
 */
export function StoryBodyPreview() {
  const { id } = useDocumentInfo()
  const bodyHtml = useFormFields(([fields]) => fields.bodyHtml?.value as string | undefined)
  const url = useFormFields(([fields]) => fields['wordpress.url']?.value as string | undefined)
  const postId = useFormFields(([fields]) => fields['wordpress.postId']?.value as number | undefined)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/summary-stories/${id}/refresh`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Refresh failed.')
      setMessage('Refreshed. Reload the page to see the new text.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Refresh failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="nic-story-preview field-type">
      <div className="nic-stories__head">
        <label className="field-label">Article text</label>
        {id && postId ? (
          <button type="button" onClick={refresh} disabled={busy}>
            {busy ? 'Refreshing…' : 'Refresh from Tobacco Reporter'}
          </button>
        ) : null}
      </div>
      <p className="nic-stories__help">
        Copied from {url ? <a href={url} target="_blank" rel="noreferrer">Tobacco Reporter</a> : 'Tobacco Reporter'}. To change the text, edit the article there and refresh.
      </p>
      {message && <p role="status" className="nic-stories__help">{message}</p>}
      {bodyHtml ? (
        <div className="nic-story-preview__body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      ) : (
        <p className="nic-stories__help">No text copied yet.</p>
      )}
    </div>
  )
}
