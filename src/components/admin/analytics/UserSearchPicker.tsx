'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

import { visitorLabel, type SimpleVisitor } from '@/lib/analytics'
import { MIN_USER_SEARCH_LENGTH } from '@/lib/userSearch'

const DEBOUNCE_MS = 300

/** Search-as-you-type user picker for the Analytics "By user" tab — a plain dropdown doesn't work at 1000+ users. */
export function UserSearchPicker({ initialLabel, rangeQuery = '' }: { initialLabel?: string; rangeQuery?:string }) {
  const [query, setQuery] = useState(initialLabel ?? '')
  const [results, setResults] = useState<SimpleVisitor[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trimmed = query.trim()
  const eligible = trimmed.length >= MIN_USER_SEARCH_LENGTH

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!eligible) return

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/users-search?q=${encodeURIComponent(trimmed)}`)
        const data = await res.json()
        setResults(data.users ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [trimmed, eligible])

  const open = eligible && !dismissed

  return (
    <div className="nic-analytics__user-search">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setDismissed(false)
        }}
        placeholder={`Search users by name or email (${MIN_USER_SEARCH_LENGTH}+ letters)…`}
        className="nic-analytics__user-search-input"
      />

      {open && (
        <div className="nic-analytics__user-search-results">
          {loading && <div className="nic-analytics__user-search-status">Searching…</div>}
          {!loading && results.length === 0 && <div className="nic-analytics__user-search-status">No matches.</div>}
          {!loading &&
            results.map((u) => (
              <Link
                key={u.id}
                href={`/admin/analytics?tab=users&userId=${u.id}${rangeQuery ? `&${rangeQuery}` : ''}`}
                className="nic-analytics__user-search-result"
                onClick={() => setDismissed(true)}
              >
                {visitorLabel(u)}
              </Link>
            ))}
        </div>
      )}
    </div>
  )
}
