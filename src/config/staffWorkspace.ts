import { isStaffUser, staffHasRole, type StaffRole } from '@/access/staffRoles'
import type { PayloadRequest } from 'payload'

type Task = {
  href: string
  label: string
  description: string
  category: string
  role: StaffRole
  icon: string
  audience: 'editorial' | 'users' | 'admin'
  daily?: boolean
}
export const STAFF_TASKS: readonly Task[] = [
  { href: '/admin/collections/research/create', label: 'Add research', description: 'Clip or write a journal article for the research desk.', category: 'Today’s editorial work', role: 'editor', icon: 'article', audience: 'editorial', daily: true },
  {
    href: '/admin/collections/articles/create',
    label: 'Add a news excerpt',
    description: 'Clip or write today’s industry coverage.',
    category: 'Today’s editorial work',
    role: 'editor',
    icon: 'article',
    audience: 'editorial',
    daily: true,
  },
  {
    href: '/admin/collections/bills/create',
    label: 'Add legislation',
    description: 'Enter a bill, regulation or legislative update.',
    category: 'Today’s editorial work',
    role: 'editor',
    icon: 'guide',
    audience: 'editorial',
    daily: true,
  },
  {
    href: '/admin/collections/publication-issues/create',
    label: 'Create a publication issue',
    description: 'Build, preview and prepare the next edition.',
    category: 'Today’s editorial work',
    role: 'editor',
    icon: 'publish',
    audience: 'editorial',
    daily: true,
  },
  {
    href: '/admin/collections/publication-issues',
    label: 'Issue drafts & archive',
    description: 'Continue an issue or review previous editions.',
    category: 'Publishing & resources',
    role: 'editor',
    icon: 'publish',
    audience: 'editorial',
  },
  {
    href: '/admin/collections/articles',
    label: 'News library',
    description: 'Find and update existing excerpts.',
    category: 'Publishing & resources',
    role: 'editor',
    icon: 'article',
    audience: 'editorial',
  },
  {
    href: '/admin/collections/bills',
    label: 'Legislation library',
    description: 'Review tracked bills and recent activity.',
    category: 'Publishing & resources',
    role: 'editor',
    icon: 'guide',
    audience: 'editorial',
  },
  {
    href: '/admin/collections/publications',
    label: 'Publication settings',
    description: 'Manage recurring titles, selection rules and schedules.',
    category: 'Publishing & resources',
    role: 'editor',
    icon: 'publish',
    audience: 'editorial',
  },
  {
    href: '/admin/collections/guides',
    label: 'Guides & resources',
    description: 'Maintain subscriber reference material.',
    category: 'Publishing & resources',
    role: 'editor',
    icon: 'guide',
    audience: 'editorial',
  },
  {
    href: '/admin/trade-reports',
    label: 'Trade Barometer',
    description: 'Prepare the monthly trade report from Census files.',
    category: 'Periodic reports & imports',
    role: 'editor',
    icon: 'trade',
    audience: 'editorial',
  },
  {
    href: '/admin/trademark-reports',
    label: 'Trademark reports',
    description: 'Import the Gazette and prepare weekly or monthly reports.',
    category: 'Periodic reports & imports',
    role: 'gatekeeper',
    icon: 'trademark',
    audience: 'editorial',
  },
  {
    href: '/admin/datasets',
    label: 'Dataset imports',
    description: 'Refresh dataset rows from a spreadsheet.',
    category: 'Periodic reports & imports',
    role: 'editor',
    icon: 'data',
    audience: 'editorial',
  },
  {
    href: '/admin/collections/access-providers',
    label: 'Manage subscriptions',
    description: 'Enable, disable or renew access provider subscriptions.',
    category: 'Daily user operations',
    role: 'gatekeeper',
    icon: 'access',
    audience: 'users',
    daily: true,
  },
  {
    href: '/admin/collections/users/create',
    label: 'Register a user',
    description: 'Create a user account and assign its access provider.',
    category: 'Daily user operations',
    role: 'gatekeeper',
    icon: 'people',
    audience: 'users',
    daily: true,
  },
  {
    href: '/admin/collections/event-registrations/create',
    label: 'Register an attendee',
    description: 'Add an attendee’s ticket against an event order.',
    category: 'Daily user operations',
    role: 'gatekeeper',
    icon: 'event',
    audience: 'users',
    daily: true,
  },
  {
    href: '/admin/collections/orders',
    label: 'Review orders',
    description: 'Review payment status and follow up on incomplete orders.',
    category: 'Daily user operations',
    role: 'gatekeeper',
    icon: 'access',
    audience: 'users',
    daily: true,
  },
  {
    href: '/admin/collections/users',
    label: 'User accounts',
    description: 'Find users, update account details and suspend access.',
    category: 'Users & events',
    role: 'gatekeeper',
    icon: 'people',
    audience: 'users',
  },
  {
    href: '/admin/access-check',
    label: 'Check user access',
    description: 'See a user’s effective subscription and provider.',
    category: 'Users & events',
    role: 'gatekeeper',
    icon: 'access',
    audience: 'users',
  },
  {
    href: '/admin/company-reports',
    label: 'Company usage reports',
    description: 'Review each provider’s users and activity for a date range.',
    category: 'Users & events',
    role: 'gatekeeper',
    icon: 'analytics',
    audience: 'users',
  },
  {
    href: '/admin/collections/email-flags',
    label: 'Email follow-up',
    description: 'Resolve delivery flags and retained suppressions.',
    category: 'Users & events',
    role: 'gatekeeper',
    icon: 'people',
    audience: 'users',
  },
  {
    href: '/admin/events',
    label: 'Event management',
    description: 'Manage event registrations, tickets, discounts and attendees.',
    category: 'Users & events',
    role: 'editor',
    icon: 'event',
    audience: 'users',
  },
  {
    href: '/admin/collections/events',
    label: 'Event programs',
    description: 'Maintain event details, speakers and schedules.',
    category: 'Publishing & resources',
    role: 'editor',
    icon: 'event',
    audience: 'editorial',
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    description: 'Review readership and publication engagement trends.',
    category: 'Administration',
    role: 'gatekeeper',
    icon: 'analytics',
    audience: 'admin',
  },
  {
    href: '/admin/collections/operational-alerts?where[resolved][equals]=false',
    label: 'Operational alerts',
    description: 'Review failed sends, imports and scheduled reports.',
    category: 'Periodic reports & imports',
    role: 'editor',
    icon: 'analytics',
    audience: 'editorial',
  },
  {
    href: '/admin/collections/staff',
    label: 'Staff accounts',
    description: 'Manage staff users and website roles.',
    category: 'Administration',
    role: 'admin',
    icon: 'people',
    audience: 'admin',
  },
  {
    href: '/admin/collections/subjects',
    label: 'Taxonomy & reference data',
    description: 'Manage subjects, products, sectors, places and sources.',
    category: 'Administration',
    role: 'admin',
    icon: 'data',
    audience: 'admin',
  },
]

export function staffTasksFor(user: PayloadRequest['user']) {
  if (!isStaffUser(user)) return []
  return STAFF_TASKS.filter(
    (task) =>
      staffHasRole(user, task.role) &&
      (user.role === 'admin' ||
        (user.role === 'gatekeeper' ? task.audience === 'users' : task.audience === 'editorial')),
  )
}

export function adminDocumentId(
  params: Record<string, string | string[] | undefined> | undefined,
  section: 'events' | 'datasets',
) {
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
