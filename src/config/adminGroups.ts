/**
 * Sidebar grouping for the admin panel (`admin.group` on each collection/
 * global). Centralized here so the labels stay consistent and renaming one
 * is a single-file change.
 */
export const ADMIN_GROUPS = {
  accounts: 'Accounts & Access',
  taxonomy: 'Taxonomy',
  excerpts: 'Excerpts',
  publishing: 'Guides & Publications',
  data: 'Data',
  events: 'Events',
  media: 'Media',
  system: 'System',
} as const
