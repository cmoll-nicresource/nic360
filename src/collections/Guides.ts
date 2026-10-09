import type { CollectionConfig } from 'payload'

import { requireBasePlanToRead, staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Guides: CollectionConfig = {
  slug: 'guides',
  admin: {
    group: ADMIN_GROUPS.publishing,
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug'],
  },
  versions: {
    drafts: true,
  },
  access: {
    // No public teaser: any subscriber (Base or Premium) can read, nobody else.
    read: requireBasePlanToRead,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'guide-files',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
  ],
}
