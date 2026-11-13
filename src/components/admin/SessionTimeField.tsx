'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import type { DateFieldClientComponent } from 'payload'

import { clockFromInput, clockInputValue } from '@/lib/sessionTime'

/**
 * A plain time box for a session's start or end. Payload's own time picker
 * shows and saves the editor's local time, so the same session would read
 * differently for staff in different places; this stores the venue's clock
 * time exactly as typed (see src/lib/sessionTime.ts).
 */
export const SessionTimeField: DateFieldClientComponent = ({ field, path, readOnly }) => {
  const { value, setValue } = useField<string | null>({ path })
  const id = `field-${path.replace(/\./g, '__')}`
  return (
    <div className="field-type date-time-field" style={{ flex: '1 1 0' }}>
      <FieldLabel htmlFor={id} label={field.label} path={path} required={field.required} />
      <input
        id={id}
        type="time"
        value={clockInputValue(value)}
        disabled={readOnly}
        onChange={(event) => setValue(clockFromInput(event.target.value))}
        style={{
          width: '100%',
          minHeight: 40,
          padding: '0 12px',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 'var(--style-radius-s, 3px)',
          background: 'var(--theme-input-bg)',
          color: 'var(--theme-elevation-800)',
          font: 'inherit',
        }}
      />
      <div className="field-description">Venue clock time, not your own.</div>
    </div>
  )
}
