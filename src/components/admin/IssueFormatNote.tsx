'use client'

import { useFormFields } from '@payloadcms/ui'
import { publicationFormatLabel } from '@/config/publicationFormats'

/** Read-only display of the format an issue takes from its publication. */
export function IssueFormatNote() {
  const format = useFormFields(([fields]) => fields.format?.value)
  const publication = useFormFields(([fields]) => fields.publication?.value)
  const id =
    publication && typeof publication === 'object' && 'id' in publication
      ? String(publication.id)
      : publication
        ? String(publication)
        : ''
  const label = publicationFormatLabel(format)
  return (
    <div className="field-type nic-issue-format-note">
      <span className="field-label">Format</span>
      <p>
        {label ? <strong>{label}</strong> : <span>Choose a publication first.</span>}
        {id && (
          <>
            {' · '}
            <a href={`/admin/collections/publications/${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">
              Set in the publication’s settings
            </a>
          </>
        )}
      </p>
    </div>
  )
}
