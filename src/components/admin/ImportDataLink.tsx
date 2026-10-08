'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

/** Shown above the save controls on a Dataset's edit screen; links out to the import wizard. */
export function ImportDataLink() {
  const { id } = useDocumentInfo()

  if (!id) {
    return <p style={{ fontSize: 13, opacity: 0.7 }}>Save this dataset once before importing rows.</p>
  }

  return (
    <a
      href={`/staff/datasets/${id}/import`}
      target="_blank"
      rel="noreferrer"
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
      Import data →
    </a>
  )
}
