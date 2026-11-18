'use client'

import { useFormFields } from '@payloadcms/ui'
import React from 'react'

import { StoryDigestField } from './StoryDigestField'
import { StoryListField } from './StoryListField'

/** The issue's `stories` field: the daily running order, or the weekly organizer for the PDF digest. */
export function StoriesField({ path = 'stories' }: { path?: string }) {
  const format = useFormFields(([fields]) => fields.format?.value)
  return format === 'story-digest' ? <StoryDigestField path={path} /> : <StoryListField path={path} />
}
