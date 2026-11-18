'use client'

import { useField } from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

/** Shared pieces of the daily (StoryListField) and weekly (StoryDigestField) story editors. */

export type Story = {
  id: number
  headline: string
  heading?: number | { id: number } | null
  publishedAt?: string | null
  image?: number | { id: number } | null
  wordpress?: { url?: string | null; postId?: number | null; imageUrl?: string | null; modifiedAt?: string | null; copiedAt?: string | null } | null
  sources?: { name: string }[] | null
}
export type Heading = { id: number; title: string }
type Post = { id: number; headline: string; excerpt: string; publishedAt: string | null; url: string; storyId: number | null }

export const idOf = (value: unknown): number | null => {
  const id = value && typeof value === 'object' ? (value as { id?: unknown; value?: unknown }).id ?? (value as { value?: unknown }).value : value
  return typeof id === 'number' ? id : Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null
}
export const headingId = (heading: Story['heading']) => (heading && typeof heading === 'object' ? heading.id : heading ?? null)
export const dateLabel = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : ''

export async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || (data as { errors?: { message?: string }[] }).errors?.[0]?.message || 'Request failed.')
  return data as T
}

type StoryPatch = Partial<{ headline: string; heading: number | null }>

/** The field's story ids plus the loaded story records and headings, with save/refresh helpers. */
export function useStoryEditor(path: string) {
  const { value, setValue } = useField<unknown[]>({ path })
  const ids = useMemo(() => (Array.isArray(value) ? value.map(idOf).filter((id): id is number => id !== null) : []), [value])
  const [stories, setStories] = useState<Map<number, Story>>(new Map())
  const [headings, setHeadings] = useState<Heading[]>([])
  const [status, setStatus] = useState<Record<number, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/summary-headings?limit=200&sort=_order&depth=0')
      .then((res) => json<{ docs: Heading[] }>(res))
      .then((data) => setHeadings(data.docs))
      .catch(() => setError('Could not load the weekly headings.'))
  }, [])

  const missing = ids.filter((id) => !stories.has(id))
  useEffect(() => {
    if (!missing.length) return
    fetch(`/api/summary-stories?where[id][in]=${missing.join(',')}&limit=${missing.length}&depth=0`)
      .then((res) => json<{ docs: Story[] }>(res))
      .then((data) => setStories((current) => new Map([...current, ...data.docs.map((s) => [s.id, s] as const)])))
      .catch(() => setError('Could not load the stories.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the set of unknown ids changes
  }, [missing.join(',')])

  const setIds = useCallback((next: number[]) => setValue(next), [setValue])
  const remember = useCallback((story: Story) => setStories((current) => new Map(current).set(story.id, story)), [])

  async function update(id: number, data: StoryPatch): Promise<Story | null> {
    setStatus((s) => ({ ...s, [id]: 'Saving…' }))
    try {
      const { doc } = await json<{ doc: Story }>(
        await fetch(`/api/summary-stories/${id}?depth=0`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
      )
      remember(doc)
      setStatus((s) => ({ ...s, [id]: 'Saved' }))
      return doc
    } catch (err) {
      setStatus((s) => ({ ...s, [id]: err instanceof Error ? err.message : 'Not saved' }))
      return null
    }
  }

  async function refresh(id: number) {
    setStatus((s) => ({ ...s, [id]: 'Refreshing from Tobacco Reporter…' }))
    try {
      const { story } = await json<{ story: Story }>(await fetch(`/api/summary-stories/${id}/refresh`, { method: 'POST' }))
      remember(story)
      setStatus((s) => ({ ...s, [id]: 'Refreshed' }))
    } catch (err) {
      setStatus((s) => ({ ...s, [id]: err instanceof Error ? err.message : 'Refresh failed' }))
    }
  }

  return { ids, setIds, stories, headings, status, error, setError, remember, update, refresh }
}

/** One story: editable headline, weekly heading, details and per-story actions. */
export function StoryRow({
  number,
  story,
  headings,
  status,
  onHeadline,
  onHeading,
  actions,
  drag,
}: {
  number: number
  story: Story | undefined
  headings: Heading[]
  status?: string
  onHeadline: (headline: string) => void
  onHeading: (heading: number | null) => void
  actions: React.ReactNode
  drag: { onDragStart: () => void; onDrop: () => void }
}) {
  return (
    <li className="nic-stories__item" draggable onDragStart={drag.onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={drag.onDrop}>
      <span className="nic-stories__grip" title="Drag to reorder">⋮⋮</span>
      <span className="nic-stories__number">{number}</span>
      {story ? (
        <div className="nic-stories__body">
          <input
            className="nic-stories__headline"
            aria-label={`Headline of story ${number}`}
            defaultValue={story.headline}
            key={`${story.id}-${story.headline}`}
            onBlur={(event) => {
              const headline = event.target.value.trim()
              if (headline && headline !== story.headline) onHeadline(headline)
            }}
          />
          <div className="nic-stories__meta">
            <select
              aria-label={`Weekly heading of story ${number}`}
              className={headingId(story.heading) ? undefined : 'nic-stories__unfiled'}
              value={headingId(story.heading) ?? ''}
              onChange={(event) => onHeading(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Choose a weekly heading…</option>
              {headings.map((h) => (
                <option key={h.id} value={h.id}>{h.title}</option>
              ))}
            </select>
            <span>{dateLabel(story.publishedAt)}</span>
            {story.wordpress?.imageUrl && !story.image && <span className="nic-stories__unfiled-text">Image not copied; Refresh to retry</span>}
            <span>{story.sources?.length ? `${story.sources.length} source${story.sources.length === 1 ? '' : 's'}` : 'No sources'}</span>
            {story.wordpress?.url && <a href={story.wordpress.url} target="_blank" rel="noreferrer">Tobacco Reporter ↗</a>}
            <a href={`/admin/collections/summary-stories/${story.id}`} target="_blank" rel="noreferrer">Edit story ↗</a>
            {status && <span role="status" className="nic-stories__status">{status}</span>}
          </div>
        </div>
      ) : (
        <div className="nic-stories__body">Loading story…</div>
      )}
      <div className="nic-stories__actions">{actions}</div>
    </li>
  )
}

export function TobaccoReporterPicker({ inIssue, onAdd, onClose }: { inIssue: number[]; onAdd: (story: Story) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | 'link' | null>(null)
  const [link, setLink] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tobacco-reporter/posts?search=${encodeURIComponent(query)}&page=${page}`)
      .then((res) => json<{ posts: Post[]; total: number }>(res))
      .then((data) => {
        if (cancelled) return
        setPosts((current) => (page === 1 ? data.posts : [...current, ...data.posts]))
        setTotal(data.total)
      })
      .catch((err) => !cancelled && setMessage(err instanceof Error ? err.message : 'Search failed.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query, page])

  async function add(body: { postId: number } | { url: string }, key: number | 'link') {
    setBusy(key)
    setMessage('')
    try {
      const { story } = await json<{ story: Story }>(
        await fetch('/api/summary-stories/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      )
      onAdd(story)
      setPosts((current) => current.map((post) => (post.id === story.wordpress?.postId ? { ...post, storyId: story.id } : post)))
      if (key === 'link') setLink('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not add that article.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="nic-stories__picker" aria-label="Add from Tobacco Reporter">
      <header>
        <strong>Add from Tobacco Reporter</strong>
        <button type="button" onClick={onClose}>Done</button>
      </header>
      <form
        className="nic-stories__search"
        onSubmit={(event) => {
          event.preventDefault()
          if (search === query && page === 1) return
          setLoading(true)
          setPage(1)
          setQuery(search)
        }}
      >
        <input type="search" placeholder="Search headlines and text" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="submit">Search</button>
      </form>
      <div className="nic-stories__search">
        <input type="url" placeholder="…or paste a Tobacco Reporter link" value={link} onChange={(event) => setLink(event.target.value)} />
        <button type="button" disabled={!link.trim() || busy === 'link'} onClick={() => add({ url: link }, 'link')}>
          {busy === 'link' ? 'Adding…' : 'Add link'}
        </button>
      </div>
      {message && <p className="nic-stories__error" role="alert">{message}</p>}
      <ul className="nic-stories__results">
        {posts.map((post) => {
          const already = post.storyId !== null && inIssue.includes(post.storyId)
          return (
            <li key={post.id}>
              <div>
                <a href={post.url} target="_blank" rel="noreferrer">{post.headline}</a>
                <small>{dateLabel(post.publishedAt)}{post.excerpt ? ` — ${post.excerpt}` : ''}</small>
              </div>
              <button type="button" disabled={already || busy === post.id} onClick={() => add({ postId: post.id }, post.id)}>
                {already ? 'In this issue' : busy === post.id ? 'Adding…' : 'Add'}
              </button>
            </li>
          )
        })}
      </ul>
      {loading ? (
        <p className="nic-stories__help">Loading…</p>
      ) : posts.length < total ? (
        <button type="button" onClick={() => { setLoading(true); setPage(page + 1) }}>Show more</button>
      ) : !posts.length ? (
        <p className="nic-stories__help">No articles found.</p>
      ) : null}
    </section>
  )
}
