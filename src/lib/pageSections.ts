/**
 * Buckets a visited path into a site section for the analytics dashboard —
 * mirrors the main nav's groupings (src/components/SiteNav.tsx) so "section"
 * in the reports means the same thing a user would recognize from the nav.
 * Not stored on PageView; computed on read, so reclassifying a path here
 * applies retroactively to history already logged.
 */
export const SECTIONS = [
  { key: 'home', label: 'Home' },
  { key: 'tracking', label: 'Tracking (News/Legislation/Trademarks)' },
  { key: 'guides', label: 'Guides' },
  { key: 'data', label: 'Data' },
  { key: 'publications', label: 'Publications' },
  { key: 'events', label: 'Events' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'account', label: 'Account' },
  { key: 'signup', label: 'Sign up' },
  { key: 'staff-tools', label: 'Staff tools' },
  { key: 'other', label: 'Other' },
] as const

export type SectionKey = (typeof SECTIONS)[number]['key']

const PREFIX_TO_SECTION: Array<{ prefix: string; key: SectionKey }> = [
  { prefix: '/articles', key: 'tracking' },
  { prefix: '/bills', key: 'tracking' },
  { prefix: '/trademarks', key: 'tracking' },
  { prefix: '/guides', key: 'guides' },
  { prefix: '/datasets', key: 'data' },
  { prefix: '/publications', key: 'publications' },
  { prefix: '/events', key: 'events' },
  { prefix: '/dashboard', key: 'dashboard' },
  { prefix: '/account', key: 'account' },
  { prefix: '/signup', key: 'signup' },
  { prefix: '/staff', key: 'staff-tools' },
  { prefix: '/admin', key: 'staff-tools' },
  { prefix: '/access-check', key: 'staff-tools' },
]

export function sectionForPath(path: string): SectionKey {
  if (path === '/') return 'home'
  const match = PREFIX_TO_SECTION.find((p) => path === p.prefix || path.startsWith(`${p.prefix}/`))
  return match?.key ?? 'other'
}

export function sectionLabel(key: SectionKey): string {
  return SECTIONS.find((s) => s.key === key)?.label ?? key
}
