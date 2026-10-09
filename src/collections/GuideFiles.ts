import type { CollectionConfig } from 'payload'

import { requireBasePlanToRead, staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const GuideFiles: CollectionConfig = {
  slug: 'guide-files',
  admin: {
    group: ADMIN_GROUPS.media,
    useAsTitle: 'filename',
    description: 'PDFs for Guides. Served through Payload\'s access-checked file route, never a public URL.',
  },
  access: {
    read: requireBasePlanToRead,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  upload: {
    mimeTypes: ['application/pdf'],
  },
  fields: [],
}
