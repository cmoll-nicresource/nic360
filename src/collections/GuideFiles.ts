import type { CollectionConfig } from 'payload'

import { requireBasePlanToRead, staffCanWrite } from '@/access/excerptAccess'

export const GuideFiles: CollectionConfig = {
  slug: 'guide-files',
  admin: {
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
