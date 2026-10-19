import type { CollectionConfig, PayloadRequest } from 'payload'
import { isStaffUser, staffHasRole } from '@/access/staffRoles'

export const TAXONOMY_COLLECTIONS = [
  'sectors',
  'products',
  'subjects',
  'locations',
  'sources',
  'countries',
  'journals',
] as const
export function isAdminManagedCollection(slug: string) {
  return slug === 'staff' || (TAXONOMY_COLLECTIONS as readonly string[]).includes(slug)
}

const GATEKEEPER_COLLECTIONS = new Set([
  'users',
  'access-providers',
  'email-flags',
  'events',
  'event-registrations',
  'orders',
  'discount-codes',
  'livestream-pings',
])
const OPERATIONS_COLLECTIONS = new Set([
  'users',
  'access-providers',
  'email-flags',
  'event-registrations',
  'orders',
  'discount-codes',
  'livestream-pings',
  'page-views',
])

/** Presentation only. Editorial API permissions remain inherited by gatekeepers. */
export function workspaceCollectionVisible(slug: string, user: PayloadRequest['user']) {
  if (!isStaffUser(user)) return false
  if (user.role === 'admin') return true
  if (isAdminManagedCollection(slug)) return false
  return user.role === 'gatekeeper'
    ? GATEKEEPER_COLLECTIONS.has(slug)
    : !OPERATIONS_COLLECTIONS.has(slug)
}

export function withWorkspaceVisibility(collection: CollectionConfig): CollectionConfig {
  const existing = collection.admin?.hidden
  return {
    ...collection,
    admin: {
      ...collection.admin,
      hidden: ({ user }) =>
        !workspaceCollectionVisible(collection.slug, user as PayloadRequest['user']) ||
        (typeof existing === 'function' ? existing({ user }) : !!existing),
    },
  }
}

export function workspaceRole(user: PayloadRequest['user']) {
  return isStaffUser(user) ? user.role : null
}
export const canSeeEditorialWorkspace = (user: PayloadRequest['user']) =>
  workspaceRole(user) === 'editor' || staffHasRole(user, 'admin')
export const canSeeUserWorkspace = (user: PayloadRequest['user']) =>
  staffHasRole(user, 'gatekeeper')
