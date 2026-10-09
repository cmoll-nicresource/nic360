import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'
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
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
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
