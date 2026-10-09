import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Subjects: CollectionConfig = {
  slug: 'subjects',
  admin: {
    group: ADMIN_GROUPS.taxonomy,
    useAsTitle: 'name',
    defaultColumns: ['name', 'parent'],
    description: 'Hierarchical index terms, e.g. RETAIL, DISTRIBUTION, & SALES > Licensing (sales).',
  },
  access: {
    read: () => true,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
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
  ],
}
