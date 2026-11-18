'use client'

import React, { useRef, useState } from 'react'

import { isAdSlotBeforeIndex } from '@/lib/publicationAds'
import { headingId, StoryRow, TobaccoReporterPicker, useStoryEditor, type Story } from './storyEditor'

/** Issue field for Daily Executive Summary stories: running order, weekly headings, and adding from Tobacco Reporter. */
export function StoryListField({ path = 'stories' }: { path?: string }) {
  const { ids, setIds, stories, headings, status, error, remember, update, refresh } = useStoryEditor(path)
  const [adding, setAdding] = useState(false)
  const dragFrom = useRef<number | null>(null)

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return
    const next = [...ids]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    setIds(next)
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
              <StoryRow
                number={index + 1}
                story={story}
                headings={headings}
                status={status[id]}
                onHeadline={(headline) => update(id, { headline })}
                onHeading={(heading) => update(id, { heading })}
                drag={{
                  onDragStart: () => (dragFrom.current = index),
                  onDrop: () => {
                    if (dragFrom.current !== null) move(dragFrom.current, index)
                    dragFrom.current = null
                  },
                }}
                actions={
                  <>
                    <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label="Move up">↑</button>
                    <button type="button" onClick={() => move(index, index + 1)} disabled={index === ids.length - 1} aria-label="Move down">↓</button>
                    {story?.wordpress?.postId && <button type="button" onClick={() => refresh(id)} title="Re-copy text, sources and image from Tobacco Reporter">Refresh</button>}
                    <button type="button" onClick={() => setIds(ids.filter((other) => other !== id))} aria-label="Remove from this issue">Remove</button>
                  </>
                }
              />
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
