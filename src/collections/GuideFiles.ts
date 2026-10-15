import type { CollectionConfig } from 'payload'

import { requireBasePlanToRead, staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'
import { usePublicationFileUrl } from '@/lib/publicationFileUrl'

export const GuideFiles: CollectionConfig = {
  slug: 'guide-files',
  labels: { singular: 'PDF file', plural: 'PDF files' },
  admin: {
    group: ADMIN_GROUPS.media,
    useAsTitle: 'filename',
    description: 'Protected PDF attachments for guides and publication issues.',
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
  hooks: { afterRead: [usePublicationFileUrl] },
  fields: [],
}
