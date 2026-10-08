import type { CollectionConfig } from 'payload'

import { anyoneCanReadTeaser, canReadFullContent, staffCanWrite } from '@/access/excerptAccess'
import { indexTermFields } from '@/fields/indexTerms'
import { ingestionField } from '@/fields/ingestion'

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'source', 'sourceDate', 'primarySubject'],
    description: 'News found across the internet; we take the title and a preview and index it.',
  },
  versions: {
    drafts: true,
  },
  access: {
    read: anyoneCanReadTeaser,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  fields: [
    {
      name: 'title',
      label: 'Article title',
      type: 'text',
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'source',
          label: 'Source title',
          type: 'relationship',
          relationTo: 'sources',
        },
        {
          name: 'sourceDate',
          label: 'Source date',
          type: 'date',
        },
      ],
    },
    {
      name: 'sourceUrl',
      label: 'Source link',
      type: 'text',
    },
    {
      name: 'excerpt',
      label: 'Article excerpt',
      type: 'richText',
      required: true,
      access: {
        read: canReadFullContent,
      },
    },
    ...indexTermFields(),
    ingestionField(),
  ],
}
