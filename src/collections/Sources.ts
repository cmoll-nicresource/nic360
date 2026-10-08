import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'

export const Sources: CollectionConfig = {
  slug: 'sources',
  admin: {
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
