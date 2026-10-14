import React from 'react'

import type { StatusPill } from '@/lib/statusPill'
import { sentenceCase } from '@/lib/textCase'

export function StatusBadge({ status }: { status: StatusPill }) {
  return <span className={`status-pill status-pill-${status.variant}`}>{status.label}</span>
}

/** A taxonomy term (sector/subject/product/location) shown as a neutral pill, sentence-cased. */
export function TagPill({ children, href }: { children: string; href?: string }) {
  if (!children) return null
  const label = sentenceCase(children)
  if (href) {
    return (
      <a href={href} className="tag-pill">
        {label}
      </a>
    )
  }
  return <span className="tag-pill">{label}</span>
}
