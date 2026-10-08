import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
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
