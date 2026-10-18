'use client'

import { useEffect, useState } from 'react'
import type { SimpleUser } from './types'
import { MIN_USER_SEARCH_LENGTH } from '@/lib/userSearch'

/** Search the full user directory instead of preloading an incomplete list of accounts. */
export function AttendeeUserPicker() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  useEffect(() => {
    if (query.trim().length < MIN_USER_SEARCH_LENGTH) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/users-search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        if (!response.ok) throw new Error('User search failed. Please try again.')
        const data = await response.json()
        if (!controller.signal.aborted) setUsers(data.users)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'User search failed.')
      } finally {
        if (!controller.signal.aborted) setBusy(false)
      }
    }, 300)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [query])
  return <>
    <div className="field">
      <label htmlFor="event-user-query">Find a user by name or email</label>
      <input id="event-user-query" type="search" value={query} onChange={e => {
        const value = e.target.value
        setQuery(value)
        setUsers([])
        setSelected('')
        setError('')
        setBusy(value.trim().length >= MIN_USER_SEARCH_LENGTH)
      }} placeholder={`Type at least ${MIN_USER_SEARCH_LENGTH} characters`} />
    </div>
    <div className="field">
      <label htmlFor="event-user-selection">User</label>
      <select id="event-user-selection" name="userId" required value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">{busy ? 'Searching…' : users.length ? 'Choose a user…' : 'Search for a user above'}</option>
        {users.map(user => <option key={user.id} value={user.id}>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email} ({user.email})</option>)}
      </select>
      {users.length === 20 && <p className="muted">Showing 20 matches. Refine the name or email to narrow your search.</p>}
      {!busy && !error && query.trim().length >= MIN_USER_SEARCH_LENGTH && !users.length && <p>No matching users.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </>
}
