'use client'

import { useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'
import { publicationIssueTitle } from '@/lib/publicationIssueTitle'

type SelectedPublication = { id: string; title: string; frequency: string; format: string }

/**
 * Follows the chosen publication: suggests the title from the publication and
 * date (preserving editor-written text) and sets the hidden format from the
 * publication's settings. A saved issue keeps its stored format unless its
 * publication is changed.
 */
export function IssueTitleDefault() {
  const { id: documentId } = useDocumentInfo()
  const publication = useFormFields(([fields]) => fields.publication?.value)
  const date = useFormFields(([fields]) => fields.issueDate?.value)
  const { value: title, setValue } = useField<string>({ path: 'title' })
  const { value: format, setValue: setFormat } = useField<string>({ path: 'format' })
  const [selected, setSelected] = useState<SelectedPublication | null>(null)
  const previous = useRef<string | null>(null)
  const id =
    publication && typeof publication === 'object' && 'id' in publication
      ? String(publication.id)
      : String(publication ?? '')
  // A saved issue keeps the format it was saved with while it stays in its publication.
  const saved = useRef(documentId ? { publication: id, format } : null)
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    fetch(`/api/publications/${encodeURIComponent(id)}?depth=0`, { signal: controller.signal })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((doc) => {
        if (doc && !controller.signal.aborted)
          setSelected({ id, title: doc.title, frequency: doc.frequency, format: doc.format })
      })
      .catch(() => {
        /* Saving still applies the server defaults if lookup fails. */
      })
    return () => controller.abort()
  }, [id])
  useEffect(() => {
    if (saved.current?.publication === id && saved.current.format) {
      if (format !== saved.current.format) setFormat(saved.current.format)
      return
    }
    if (!selected || selected.id !== id || !selected.format) return
    if (format !== selected.format) setFormat(selected.format)
  }, [selected, id, format, setFormat])
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
