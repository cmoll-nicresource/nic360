'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'
import { publicationIssueTitle } from '@/lib/publicationIssueTitle'

/** Update suggested titles with the date/publication, while preserving editor-written text. */
export function IssueTitleDefault() {
  const publication = useFormFields(([fields]) => fields.publication?.value)
  const date = useFormFields(([fields]) => fields.issueDate?.value)
  const { value: title, setValue } = useField<string>({ path: 'title' })
  const [selected, setSelected] = useState<{ id: string; title: string; frequency: string } | null>(
    null,
  )
  const previous = useRef<string | null>(null)
  const id =
    publication && typeof publication === 'object' && 'id' in publication
      ? String(publication.id)
      : String(publication ?? '')
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    fetch(`/api/publications/${encodeURIComponent(id)}?depth=0`, { signal: controller.signal })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((doc) => {
        if (doc && !controller.signal.aborted)
          setSelected({ id, title: doc.title, frequency: doc.frequency })
      })
      .catch(() => {
        /* Saving still applies the server default if lookup fails. */
      })
    return () => controller.abort()
  }, [id])
  useEffect(() => {
    if (!selected || selected.id !== id || typeof date !== 'string') return
    const next = publicationIssueTitle(selected.title, selected.frequency, date)
    if (!next) return
    const current = title
    if (current !== next && (!current?.trim() || current === previous.current)) setValue(next)
    previous.current = next
  }, [selected, id, date, title, setValue])
  return null
}
