import type { CollectionConfig } from 'payload'
import {
  anyoneCanReadTeaser,
  canReadFullContent,
  staffCanWrite,
} from '@/access/excerptAccess'
import { staffHasRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'
import { ingestionField } from '@/fields/ingestion'
import { buildSearchTextHook } from '@/hooks/buildSearchText'
import { normalizeDoi } from '@/lib/research/doi'

export const Research: CollectionConfig = {
  slug: 'research',
  defaultSort: '-publishedDate',
  labels: { singular: 'Research article', plural: 'Industry Research' },
  admin: {
    group: ADMIN_GROUPS.tracking,
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'journal', 'authors', 'publishedDate'],
    description:
      'Journal articles and research excerpts. Titles are public; the body and DOI link require a subscription.',
  },
  versions: { drafts: true },
  access: {
    read: anyoneCanReadTeaser,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (data) {
          data.doiLink =
            normalizeDoi(
              Object.hasOwn(data, 'doiLink')
                ? data.doiLink
                : originalDoc?.doiLink,
            ) ?? null
          data.doiKey = data.doiLink?.toLowerCase() ?? null
        }
        return data
      },
    ],
    beforeChange: [buildSearchTextHook(['body'])],
  },
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    {
      name: 'authors',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Keep author order; separate names with semicolons.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'publishedDate',
          label: 'Published date',
          type: 'date',
          required: true,
        },
        {
          name: 'journal',
          type: 'relationship',
          relationTo: 'journals',
          required: true,
        },
      ],
    },
    {
      name: 'doiLink',
      label: 'DOI link',
      type: 'text',
      access: { read: canReadFullContent },
      admin: { description: 'Enter a DOI or https://doi.org/ link.' },
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
      access: { read: canReadFullContent },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      unique: true,
      admin: { hidden: true },
      access: { read: canReadFullContent },
    },
    {
      name: 'doiKey',
      type: 'text',
      unique: true,
      admin: { hidden: true },
      access: { read: ({ req }) => staffHasRole(req.user, 'editor') },
    },
    {
      ...ingestionField(),
      access: { read: ({ req }) => staffHasRole(req.user, 'editor') },
      admin: { hidden: true },
    },
    {
      name: 'searchText',
      type: 'text',
      admin: { hidden: true },
      access: { read: () => false },
    },
  ],
}
