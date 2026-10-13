import Link from 'next/link'
import React from 'react'

import type { HistoryEntry } from '@/lib/analytics'
import { visitorLabel } from '@/lib/analytics'

/** A simple time-ordered table of page views for the admin analytics view, optionally hiding the path or visitor column when the caller already fixed that value. */
export function AdminHistoryTable({
  entries,
  showPath = true,
  showVisitor = true,
  emptyMessage = 'No visits recorded yet.',
}: {
  entries: HistoryEntry[]
  showPath?: boolean
  showVisitor?: boolean
  emptyMessage?: string
}) {
  if (entries.length === 0) return <p className="nic-analytics__muted">{emptyMessage}</p>

  return (
    <table className="nic-analytics__table">
      <thead>
        <tr>
          <th>When</th>
          {showVisitor && <th>Visitor</th>}
          {showPath && <th>Path</th>}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td>{new Date(e.createdAt).toLocaleString()}</td>
            {showVisitor && (
              <td>
                {e.visitor ? (
                  <Link href={`/admin/analytics?tab=users&userId=${e.visitor.id}`}>{visitorLabel(e.visitor)}</Link>
                ) : (
                  <span className="nic-analytics__muted">Signed out</span>
                )}
              </td>
            )}
            {showPath && (
              <td>
                <Link href={`/admin/analytics?tab=pages&path=${encodeURIComponent(e.path)}`}>{e.path}</Link>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
