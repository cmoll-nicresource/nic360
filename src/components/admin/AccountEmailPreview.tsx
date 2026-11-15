'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

import { linkIsLive, type AccountEmailKind } from '@/lib/accountEmailLog'

type Doc = { kind?: AccountEmailKind; createdAt?: string; html?: string | null; linkExpiresAt?: string | null }

/**
 * Shows a logged message exactly as sent, in a sandboxed frame. While its link
 * still works, the message is shown so staff can copy the link; afterwards the
 * link is dead, so the message is hidden rather than kept on screen.
 */
export function AccountEmailPreview() {
  const { savedDocumentData } = useDocumentInfo()
  const doc = savedDocumentData as Doc | undefined
  if (!doc?.kind || !doc.createdAt) return null

  if (!doc.html) {
    return (
      <p style={{ marginBottom: 24, fontSize: 13 }}>
        {doc.kind === 'staff-reset'
          ? 'The content of staff password emails is deliberately not kept.'
          : 'No message content was kept for this entry.'}
      </p>
    )
  }
  if (!linkIsLive(doc.kind, doc.createdAt)) {
    return (
      <p style={{ marginBottom: 24, fontSize: 13 }}>
        The link in this message has expired, so it is no longer shown. Open the user and create a new password link to
        help them sign in.
      </p>
    )
  }
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13 }}>
        This link works until {doc.linkExpiresAt ? new Date(doc.linkExpiresAt).toLocaleTimeString() : 'it expires'}. To
        pass it on, open the message and copy the link; do not send it to anyone but the person it was meant for.
      </p>
      <iframe
        title="Message as sent"
        sandbox=""
        srcDoc={doc.html}
        style={{ width: '100%', height: 560, border: '1px solid var(--theme-elevation-150)', background: '#fff' }}
      />
    </div>
  )
}
