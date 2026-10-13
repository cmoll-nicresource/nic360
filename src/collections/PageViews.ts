import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const PageViews: CollectionConfig = {
  slug: 'page-views',
  labels: { singular: 'Page view', plural: 'Page views' },
  admin: {
    group: ADMIN_GROUPS.system,
    useAsTitle: 'path',
    defaultColumns: ['path', 'visitor', 'createdAt'],
    description:
      'A log of which reader visited which front-end page and when, for first-party traffic reporting (no third-party analytics). Staff visits are not tracked. See /staff/analytics for the dashboard.',
  },
  access: {
    // Written only by the server (src/lib/logPageView.ts, overrideAccess: true) — never via the API directly.
    read: staffHasMinRole('gatekeeper'),
    create: () => false,
    update: () => false,
    delete: staffHasMinRole('admin'),
  },
  fields: [
    { name: 'path', type: 'text', required: true, index: true },
    {
      name: 'visitor',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { description: 'Blank for a signed-out visitor. Staff visits are never logged.' },
    },
  ],
}
