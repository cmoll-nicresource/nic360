/** Issue layouts. A publication sets one; its new issues inherit it (see IssueTitleDefault and defaultIssueFields). */
export const PUBLICATION_FORMAT_OPTIONS = [
  { label: 'Excerpt list', value: 'excerpt-list' },
  { label: 'Tobacco Reporter stories', value: 'story-list' },
  { label: 'Tobacco Reporter stories (weekly PDF)', value: 'story-digest' },
  { label: 'PDF report', value: 'pdf-report' },
  { label: 'Custom HTML', value: 'custom-html' },
] as const

export type PublicationFormat = (typeof PUBLICATION_FORMAT_OPTIONS)[number]['value']

export function publicationFormatLabel(value: unknown): string | null {
  return PUBLICATION_FORMAT_OPTIONS.find((option) => option.value === value)?.label ?? null
}
