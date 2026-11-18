'use client'

import { useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'
import React, { useRef, useState } from 'react'

import { groupByHeading, orderByHeading } from '@/lib/summaryStories/digest'
import { headingId, json, StoryRow, TobaccoReporterPicker, useStoryEditor, type Story } from './storyEditor'

type WeekResponse = { ids: number[]; issues: { id: number; title: string; issueDate: string; count: number }[]; drafts: number }

/**
 * Weekly Executive Summary organizer: gathers the week's Daily Executive
 * Summary stories, shows them under the weekly headings in PDF order, and
 * generates the PDF from the saved issue.
 */
export function StoryDigestField({ path = 'stories' }: { path?: string }) {
  const { ids, setIds, stories, headings, status, error, remember, update, refresh } = useStoryEditor(path)
  const { id: docId, savedDocumentData } = useDocumentInfo()
  const modified = useFormModified()
  const issueDate = useFormFields(([fields]) => fields.issueDate?.value as string | undefined)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<'week' | 'pdf' | null>(null)
  const [message, setMessage] = useState('')
  const dragged = useRef<number | null>(null)
  const sent = ['sending', 'sent'].includes((savedDocumentData as { email?: { status?: string } } | undefined)?.email?.status ?? '')

  const headingOf = (id: number, overrides: Map<number, number | null> = new Map()) =>
    overrides.has(id) ? overrides.get(id) : headingId(stories.get(id)?.heading)
  const ordered = orderByHeading(ids, (id) => headingOf(id), headings)
  const groups = groupByHeading(ids, (id) => headingOf(id), headings)
  const numberOf = new Map(ordered.map((id, i) => [id, i + 1]))
  const unfiled = groups.find((g) => g.heading === null)?.stories.length ?? 0

  /** Saves the list in PDF order, taking any just-changed headings into account. */
  const commit = (next: number[], overrides = new Map<number, number | null>()) =>
    setIds(orderByHeading(next, (id) => headingOf(id, overrides), headings))

  async function setHeading(id: number, heading: number | null, next: number[] = ordered) {
    const overrides = new Map([[id, heading]])
    commit(next, overrides)
    await update(id, { heading })
  }

  function moveWithin(id: number, step: -1 | 1) {
    const group = groups.find((g) => g.stories.includes(id))
    if (!group) return
    const at = group.stories.indexOf(id)
    const other = group.stories[at + step]
    if (other === undefined) return
    const next = [...ordered]
    const a = next.indexOf(id), b = next.indexOf(other)
    ;[next[a], next[b]] = [next[b], next[a]]
    commit(next)
  }

  function dropOn(targetId: number) {
    const id = dragged.current
    dragged.current = null
    if (id === null || id === targetId) return
    const next = ordered.filter((other) => other !== id)
    next.splice(next.indexOf(targetId), 0, id)
    const targetHeading = headingOf(targetId) ?? null
    if (targetHeading !== (headingOf(id) ?? null)) setHeading(id, targetHeading, next)
    else commit(next)
  }

  async function addWeek() {
    if (!issueDate) return setMessage('Set the issue date first.')
    setBusy('week')
    setMessage('')
    try {
      const params = new URLSearchParams({ issueDate: String(issueDate) })
      const week = await json<WeekResponse>(await fetch(`/api/publication-issues/week-stories?${params}`))
      const fresh = week.ids.filter((id) => !ids.includes(id))
      setIds([...ids, ...fresh])
      const from = week.issues.map((i) => i.title).join(', ')
      setMessage(
        `${fresh.length} new ${fresh.length === 1 ? 'story' : 'stories'} from ${week.issues.length} published Daily Executive ${week.issues.length === 1 ? 'Summary' : 'Summaries'}${from ? ` (${from})` : ''}.` +
          (week.drafts ? ` ${week.drafts} unpublished daily ${week.drafts === 1 ? 'issue was' : 'issues were'} skipped.` : '') +
          (fresh.length ? ' Save the draft to keep them.' : ''),
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not collect the week’s stories.')
    } finally {
      setBusy(null)
    }
  }

  async function generate() {
    setBusy('pdf')
    setMessage('')
    try {
      const result = await json<{ pages: number; storyCount: number; warnings: string[] }>(
        await fetch(`/api/publication-issues/${docId}/generate-digest`, { method: 'POST' }),
      )
      setMessage(`PDF generated: ${result.storyCount} stories, ${result.pages} pages.${result.warnings.length ? ' ' + result.warnings.join(' ') : ''} Reloading…`)
      window.setTimeout(() => window.location.reload(), result.warnings.length ? 2500 : 600)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'PDF generation failed.')
      setBusy(null)
    }
  }

  function added(story: Story) {
    remember(story)
    if (!ids.includes(story.id)) setIds([...ids, story.id])
  }

  const generateBlocked = !docId ? 'Save the draft first.' : modified ? 'Save the draft first; the PDF is built from the saved issue.' : sent ? 'This issue has been sent.' : unfiled ? 'Give every story a weekly heading first.' : !ids.length ? 'Add stories first.' : ''

  return (
    <div className="nic-stories field-type">
      <div className="nic-stories__head">
        <label className="field-label">Stories</label>
        <span className="nic-stories__count">
          {ids.length} {ids.length === 1 ? 'story' : 'stories'} under {groups.filter((g) => g.heading).length} headings
          {unfiled ? ` · ${unfiled} without a weekly heading` : ''}
        </span>
      </div>
      <p className="nic-stories__help">
        In PDF order. Drag a story onto another to move it there (it takes that story’s heading), or change its heading. Heading and headline changes save to the story right away; save the issue to keep the list. Headings and their order are managed under Executive Summary headings.
      </p>
      <div className="nic-stories__toolbar">
        <button type="button" onClick={addWeek} disabled={busy !== null || sent}>
          {busy === 'week' ? 'Collecting…' : 'Add this week’s DES stories'}
        </button>
        <button type="button" onClick={() => setAdding(true)} disabled={adding || sent}>+ Add from Tobacco Reporter</button>
        <button type="button" className="nic-stories__primary" onClick={generate} disabled={busy !== null || !!generateBlocked} title={generateBlocked || undefined}>
          {busy === 'pdf' ? 'Generating PDF…' : 'Generate PDF'}
        </button>
        {generateBlocked && ids.length > 0 && <small>{generateBlocked}</small>}
      </div>
      {(message || error) && <p className="nic-stories__help" role="status">{message || error}</p>}

      {adding && <TobaccoReporterPicker inIssue={ids} onAdd={added} onClose={() => setAdding(false)} />}

      {groups.map((group) => (
        <section key={group.heading?.id ?? 'unfiled'} className={`nic-stories__group${group.heading ? '' : ' nic-stories__group--unfiled'}`}>
          <h4>
            {group.heading?.title ?? 'No weekly heading yet'} <small>{group.stories.length}</small>
          </h4>
          <ol className="nic-stories__list">
            {group.stories.map((id, at) => {
              const story = stories.get(id)
              return (
                <StoryRow
                  key={id}
                  number={numberOf.get(id) ?? 0}
                  story={story}
                  headings={headings}
                  status={status[id]}
                  onHeadline={(headline) => update(id, { headline })}
                  onHeading={(heading) => setHeading(id, heading)}
                  drag={{ onDragStart: () => (dragged.current = id), onDrop: () => dropOn(id) }}
                  actions={
                    <>
                      <button type="button" onClick={() => moveWithin(id, -1)} disabled={at === 0} aria-label="Move up within heading">↑</button>
                      <button type="button" onClick={() => moveWithin(id, 1)} disabled={at === group.stories.length - 1} aria-label="Move down within heading">↓</button>
                      {story?.wordpress?.postId && <button type="button" onClick={() => refresh(id)} title="Re-copy text, sources and image from Tobacco Reporter">Refresh</button>}
                      <button type="button" onClick={() => commit(ordered.filter((other) => other !== id))} aria-label="Remove from this issue">Remove</button>
                    </>
                  }
                />
              )
            })}
          </ol>
        </section>
      ))}
      {!ids.length && <p className="nic-stories__help">No stories yet. Start with “Add this week’s DES stories”.</p>}
    </div>
  )
}
