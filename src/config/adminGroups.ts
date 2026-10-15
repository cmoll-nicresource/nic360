/**
 * Sidebar grouping for the admin panel (`admin.group` on each collection/
 * global). Centralized here so the labels stay consistent and renaming one
 * is a single-file change.
 */
export const ADMIN_GROUPS = {
  accounts: 'Audience & access',
  taxonomy: 'Reference library',
  tracking: 'News & tracking',
  publishing: 'Publishing',
  data: 'Datasets',
  events: 'Events',
  media: 'Files & media',
  system: 'Logs & settings',
} as const
