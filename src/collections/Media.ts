import type { CollectionConfig } from 'payload'

import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: ADMIN_GROUPS.media,
    useAsTitle: 'alt',
  },
  access: {
    read: () => true,
  },
  upload: {
    // Images for avatars/thumbnails, PDFs for trademark filings/sponsor logos,
    // and CSVs archived from each dataset import.
    mimeTypes: ['image/*', 'application/pdf', 'text/csv'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
}
