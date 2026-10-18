import type { PayloadRequest } from 'payload'
import { isStaffUser, staffHasRole } from '@/access/staffRoles'
import { canSeeEditorialWorkspace, canSeeUserWorkspace } from './workspaceVisibility'

export type WorkspaceMenuLink = { label: string; href: string }
export type WorkspaceMenuGroup = { label: string; links: WorkspaceMenuLink[] }
export type WorkspaceMenuData = {
  guides: { id: number; title: string }[]
  past?: { id: number; name: string }
  upcoming?: { id: number; name: string }
  current: { id: number; name: string }[]
}
const collection = (slug: string, label: string, create = false): WorkspaceMenuLink => ({
  label, href: `/admin/collections/${slug}${create ? '/create' : ''}`,
})
export function workspaceMenuFor(user: PayloadRequest['user'], data: WorkspaceMenuData): WorkspaceMenuGroup[] {
  if (!isStaffUser(user)) return []
  const editorial = canSeeEditorialWorkspace(user), userOperations = canSeeUserWorkspace(user), admin = staffHasRole(user, 'admin')
  const groups: WorkspaceMenuGroup[] = []
  if (editorial) groups.push(
    { label: 'News', links: [collection('articles', 'Find an article'), collection('articles', 'Create an article', true)] },
    { label: 'Bills', links: [collection('bills', 'Find a bill'), collection('bills', 'Create a bill', true)] },
    { label: 'Publications', links: [
      collection('publication-issues', 'Find a publication'), collection('publication-issues', 'Create a publication', true),
      collection('publication-ads', 'Manage ads'), collection('newsletter-deliveries', 'Publication Deliveries'),
      collection('publications', 'Publication settings'),
    ] },
    { label: 'Guides', links: [
      ...data.guides.map(guide => ({ label: guide.title, href: `/admin/collections/guides/${guide.id}` })),
      collection('guides', 'All guides'),
    ] },
    { label: 'Data', links: [
      { label: 'Datasets', href: '/admin/datasets' }, { label: 'Trade Data Imports', href: '/admin/trade-reports' },
      ...(admin ? [{ label: 'Trademark Imports', href: '/admin/trademark-reports' }] : []),
    ] },
  )
  if (admin) groups.push({ label: 'Taxonomy', links: ['Sectors', 'Products', 'Subjects', 'Locations', 'Sources', 'Countries'].map(label => collection(label.toLowerCase(), label)) })
  if (userOperations) groups.push({ label: 'Users', links: [
    collection('users', 'Find a User'), collection('users', 'Create a User', true),
    collection('access-providers', 'Find an Access Provider'), collection('access-providers', 'Create an Access Provider', true),
    collection('orders', 'Find an Order'), { label: 'Check user access', href: '/admin/access-check' }, collection('email-flags', 'Email follow-up'),
  ] })
  groups.push({ label: 'Events', links: [
    ...(data.past ? [{ label: `Manage ${data.past.name}`, href: `/admin/events/${data.past.id}/manage` }] : []),
    ...data.current.map(event => ({ label: `Manage ${event.name} (underway)`, href: `/admin/events/${event.id}/manage` })),
    ...(data.upcoming ? [{ label: `Manage ${data.upcoming.name}`, href: `/admin/events/${data.upcoming.id}/manage` }] : []),
    ...(editorial ? [collection('events', 'Create new event', true)] : []),
    { label: 'Past events', href: '/admin/events?period=past' }, { label: 'All events', href: '/admin/events' },
  ] })
  if (userOperations) groups.push({ label: 'Analytics', links: [
    ...['Pages', 'Users', 'Publications', 'Events'].map(label => ({ label, href: `/admin/analytics?tab=${label.toLowerCase()}` })),
    { label: 'Company usage', href: '/admin/company-reports' },
  ] })
  if (admin) groups.push({ label: 'Admin', links: [
    collection('staff', 'Staff'), collection('ses-outbox', 'SES outbox'), collection('ses-events', 'SES Events'), collection('operational-alerts', 'Operational Alerts'),
    { label: 'Connected browsers', href: '/admin/connected-browsers' }, collection('media', 'Media library'),
  ] })
  return groups
}
