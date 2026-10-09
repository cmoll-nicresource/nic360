import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Sources: CollectionConfig = {
  slug: 'sources',
  admin: {
    group: ADMIN_GROUPS.taxonomy,
    useAsTitle: 'name',
    description: 'Article source publications, e.g. The Kenya Times (thekenyatimes.com).',
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
      name: 'domain',
      type: 'text',
      unique: true,
    },
  ],
}
