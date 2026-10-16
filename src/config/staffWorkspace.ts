import { staffHasRole, type StaffRole } from '@/access/staffRoles'
import type { PayloadRequest } from 'payload'

export const STAFF_TASKS = [
  {
    href: '/admin/collections/operational-alerts?where[resolved][equals]=false',
    label: 'Operational alerts',
    description: 'Review failed sends, stalled imports and missing scheduled reports.',
    category: 'Operations',
    role: 'editor',
    icon: 'analytics',
  },
  {
    href: '/admin/trade-reports',
    label: 'Trade Barometer',
    description: 'Upload Census files and prepare the monthly trade report.',
    category: 'Imports & reports',
    role: 'editor',
    icon: 'trade',
  },
  {
    href: '/admin/trademark-reports',
    label: 'Trademark reports',
    description: 'Import the USPTO Gazette and prepare trademark reports.',
    category: 'Imports & reports',
    role: 'gatekeeper',
    icon: 'trademark',
  },
  {
    href: '/admin/datasets',
    label: 'Dataset imports',
    description: 'Choose a dataset, map a spreadsheet, and refresh its rows.',
    category: 'Imports & reports',
    role: 'editor',
    icon: 'data',
  },
  {
    href: '/admin/collections/publication-issues',
    label: 'Publication issues',
    description: 'Review drafts, build issues, and manage publication sends.',
    category: 'Publishing',
    role: 'editor',
    icon: 'publish',
  },
  {
    href: '/admin/collections/articles',
    label: 'News & research',
    description: 'Write and organize the latest industry coverage.',
    category: 'Publishing',
    role: 'editor',
    icon: 'article',
  },
  {
    href: '/admin/collections/guides',
    label: 'Guides & resources',
    description: 'Maintain member guides and supporting documents.',
    category: 'Publishing',
    role: 'editor',
    icon: 'guide',
  },
  {
    href: '/admin/events',
    label: 'Event management',
    description: 'Manage programs, speakers, sponsors, tickets, and attendees.',
    category: 'Operations',
    role: 'editor',
    icon: 'event',
  },
  {
    href: '/admin/collections/users',
    label: 'Readers & membership',
    description: 'Find readers and review their account details.',
    category: 'Operations',
    role: 'editor',
    icon: 'people',
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    description: 'Explore readership, publication engagement, and advertising.',
    category: 'Operations',
    role: 'gatekeeper',
    icon: 'analytics',
  },
  {
    href: '/admin/access-check',
    label: 'Reader access',
    description: 'Check membership providers and effective reader access.',
    category: 'Operations',
    role: 'gatekeeper',
    icon: 'access',
  },
] as const satisfies ReadonlyArray<{
  href: string
  label: string
  description: string
  category: string
  role: StaffRole
  icon: string
}>

export function staffTasksFor(user: PayloadRequest['user']) {
  return STAFF_TASKS.filter((task) => staffHasRole(user, task.role))
}

export function adminDocumentId(
  params: Record<string, string | string[] | undefined> | undefined,
  section: 'events' | 'datasets',
): string | undefined {
  const segments = params?.segments
  if (
    !Array.isArray(segments) ||
    segments.length !== 3 ||
    segments[0] !== section ||
    segments[2] !== (section === 'events' ? 'manage' : 'import')
  )
    return undefined
  const id = segments[1]
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? id : undefined
}
