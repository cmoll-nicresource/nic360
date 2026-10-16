import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    group: ADMIN_GROUPS.taxonomy,
    useAsTitle: 'name',
    description: 'Flat index-term list, including a catch-all "All Products".',
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
      unique: true,
    },
  ],
}
