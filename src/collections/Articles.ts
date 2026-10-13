import type { CollectionConfig } from 'payload'

import { anyoneCanReadTeaser, canReadFullContent, staffCanWrite } from '@/access/excerptAccess'
import { indexTermFields } from '@/fields/indexTerms'
import { ingestionField } from '@/fields/ingestion'
import { ADMIN_GROUPS } from '@/config/adminGroups'
import { buildSearchTextHook } from '@/hooks/buildSearchText'

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'News Item', plural: 'News' },
  admin: {
    group: ADMIN_GROUPS.tracking,
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'primarySubject', 'locations', 'source', 'sourceDate'],
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
  hooks: {
    beforeChange: [buildSearchTextHook(['excerpt'])],
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
    {
      name: 'searchText',
      type: 'text',
      admin: { hidden: true },
      access: { read: () => false },
    },
  ],
}
