'use client'

import { useField } from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isAdSlotBeforeIndex } from '@/lib/publicationAds'

type Story = {
  id: number
  headline: string
  heading?: number | { id: number } | null
  publishedAt?: string | null
  image?: number | { id: number } | null
  wordpress?: { url?: string | null; postId?: number | null; imageUrl?: string | null; modifiedAt?: string | null; copiedAt?: string | null } | null
  sources?: { name: string }[] | null
}
type Heading = { id: number; title: string }
type Post = { id: number; headline: string; excerpt: string; publishedAt: string | null; url: string; storyId: number | null }

const idOf = (value: unknown): number | null => {
  const id = value && typeof value === 'object' ? (value as { id?: unknown; value?: unknown }).id ?? (value as { value?: unknown }).value : value
  return typeof id === 'number' ? id : Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null
}
const headingId = (heading: Story['heading']) => (heading && typeof heading === 'object' ? heading.id : heading ?? null)
const dateLabel = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : ''

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string; errors?: { message?: string }[] }).error || (data as { errors?: { message?: string }[] }).errors?.[0]?.message || 'Request failed.')
  return data as T
}

async function saveStory(id: number, data: Partial<{ headline: string; heading: number | null }>) {
  return json<{ doc: Story }>(
    await fetch(`/api/summary-stories/${id}?depth=0`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
}

/** Issue field for Daily Executive Summary stories: running order, weekly headings, and adding from Tobacco Reporter. */
export function StoryListField({ path = 'stories' }: { path?: string }) {
  const { value, setValue } = useField<unknown[]>({ path })
  const ids = useMemo(() => (Array.isArray(value) ? value.map(idOf).filter((id): id is number => id !== null) : []), [value])
  const [stories, setStories] = useState<Map<number, Story>>(new Map())
  const [headings, setHeadings] = useState<Heading[]>([])
  const [status, setStatus] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const dragFrom = useRef<number | null>(null)

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
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return
    const next = [...ids]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    setIds(next)
  }
  const remember = (story: Story) => setStories((current) => new Map(current).set(story.id, story))

  async function update(id: number, data: Partial<{ headline: string; heading: number | null }>) {
    setStatus((s) => ({ ...s, [id]: 'Saving…' }))
    try {
      const { doc } = await saveStory(id, data)
      remember(doc)
      setStatus((s) => ({ ...s, [id]: 'Saved' }))
    } catch (err) {
      setStatus((s) => ({ ...s, [id]: err instanceof Error ? err.message : 'Not saved' }))
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

  function added(story: Story) {
    remember(story)
    if (!ids.includes(story.id)) setIds([...ids, story.id])
  }

  const unfiled = ids.filter((id) => stories.has(id) && !headingId(stories.get(id)!.heading)).length

  return (
    <div className="nic-stories field-type">
      <div className="nic-stories__head">
        <label className="field-label">Stories</label>
        <span className="nic-stories__count">
          {ids.length} {ids.length === 1 ? 'story' : 'stories'}
          {unfiled ? ` · ${unfiled} without a weekly heading` : ''}
        </span>
      </div>
      <p className="nic-stories__help">
        Running order of the email. An ad goes before story 1, 3, 5… Headline and weekly heading changes save to the story right away; save the issue to keep the order.
      </p>
      {error && <p className="nic-stories__error" role="alert">{error}</p>}

      <ol className="nic-stories__list">
        {ids.map((id, index) => {
          const story = stories.get(id)
          return (
            <React.Fragment key={id}>
              {isAdSlotBeforeIndex(index) && <li className="nic-stories__ad" aria-hidden>Ad slot</li>}
              <li
                className="nic-stories__item"
                draggable
                onDragStart={() => (dragFrom.current = index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragFrom.current !== null) move(dragFrom.current, index)
                  dragFrom.current = null
                }}
              >
                <span className="nic-stories__grip" title="Drag to reorder">⋮⋮</span>
                <span className="nic-stories__number">{index + 1}</span>
                {story ? (
                  <div className="nic-stories__body">
                    <input
                      className="nic-stories__headline"
                      aria-label={`Headline of story ${index + 1}`}
                      defaultValue={story.headline}
                      key={`${story.id}-${story.headline}`}
                      onBlur={(event) => {
                        const headline = event.target.value.trim()
                        if (headline && headline !== story.headline) update(id, { headline })
                      }}
                    />
                    <div className="nic-stories__meta">
                      <select
                        aria-label={`Weekly heading of story ${index + 1}`}
                        className={headingId(story.heading) ? undefined : 'nic-stories__unfiled'}
                        value={headingId(story.heading) ?? ''}
                        onChange={(event) => update(id, { heading: event.target.value ? Number(event.target.value) : null })}
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
                      <a href={`/admin/collections/summary-stories/${id}`} target="_blank" rel="noreferrer">Edit story ↗</a>
                      {status[id] && <span role="status" className="nic-stories__status">{status[id]}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="nic-stories__body">Loading story {id}…</div>
                )}
                <div className="nic-stories__actions">
                  <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label="Move up">↑</button>
                  <button type="button" onClick={() => move(index, index + 1)} disabled={index === ids.length - 1} aria-label="Move down">↓</button>
                  {story?.wordpress?.postId && <button type="button" onClick={() => refresh(id)} title="Re-copy text, sources and image from Tobacco Reporter">Refresh</button>}
                  <button type="button" onClick={() => setIds(ids.filter((other) => other !== id))} aria-label="Remove from this issue">Remove</button>
                </div>
              </li>
            </React.Fragment>
          )
        })}
      </ol>

      {adding ? (
        <TobaccoReporterPicker inIssue={ids} onAdd={added} onClose={() => setAdding(false)} />
      ) : (
        <button type="button" className="nic-stories__add" onClick={() => setAdding(true)}>+ Add from Tobacco Reporter</button>
      )}
    </div>
  )
}

function TobaccoReporterPicker({ inIssue, onAdd, onClose }: { inIssue: number[]; onAdd: (story: Story) => void; onClose: () => void }) {
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
