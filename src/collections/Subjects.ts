import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Subjects: CollectionConfig = {
  slug: 'subjects',
  admin: {
    group: ADMIN_GROUPS.taxonomy,
    useAsTitle: 'name',
    defaultColumns: ['name', 'parent'],
    description:
      'Hierarchical index terms, e.g. RETAIL, DISTRIBUTION, & SALES > Licensing (sales).',
  },
  access: {
    read: () => true,
    create: staffHasMinRole('admin'),
    update: staffHasMinRole('admin'),
    delete: staffHasMinRole('admin'),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'subjects',
      admin: {
        description: 'Leave blank for a top-level subject.',
      },
    },
    {
      name: 'legacyId',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        description: "Old site's taxonomies.id, for matching excerpt_indices during migration.",
      },
    },
  ],
}
