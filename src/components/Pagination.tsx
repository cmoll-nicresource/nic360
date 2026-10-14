import Link from 'next/link'
import React from 'react'

/** basePath should already include any active filter query params (minus `page`). */
export function Pagination({
  basePath,
  page,
  totalPages,
  totalDocs,
  pageSize,
}: {
  basePath: string
  page: number
  totalPages: number
  totalDocs: number
  pageSize: number
}) {
  if (totalDocs === 0) return null

  const join = basePath.includes('?') ? '&' : '?'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalDocs)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginTop: 16,
        flexWrap: 'wrap',
      }}
    >
      <span className="muted" style={{ fontSize: 13 }}>
        Showing {start}–{end} of {totalDocs.toLocaleString()}
      </span>
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8 }}>
          {page > 1 && (
            <Link href={`${basePath}${join}page=${page - 1}`} className="btn btn-secondary">
              ← Previous
            </Link>
          )}
          {page < totalPages && (
            <Link href={`${basePath}${join}page=${page + 1}`} className="btn btn-secondary">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
