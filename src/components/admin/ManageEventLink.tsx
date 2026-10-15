'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

/** Shown above the save controls on an Event's edit screen; links out to the one-screen event dashboard. */
export function ManageEventLink() {
  const { id } = useDocumentInfo()

  if (!id) {
    return <p style={{ fontSize: 13, opacity: 0.7 }}>Save this event once before managing it from one screen.</p>
  }

  return (
    <a
      href={`/admin/events/${id}/manage`}
      style={{
        display: 'inline-block',
        padding: '8px 14px',
        borderRadius: 4,
        background: 'var(--theme-success-500, #1f6f5c)',
        color: '#fff',
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      Manage this event →
    </a>
  )
}
