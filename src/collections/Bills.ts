import type { CollectionConfig } from 'payload'

import { anyoneCanReadTeaser, canReadFullContent, staffCanWrite } from '@/access/excerptAccess'
import { indexTermFields } from '@/fields/indexTerms'
import { ingestionField } from '@/fields/ingestion'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Bills: CollectionConfig = {
  slug: 'bills',
  admin: {
    group: ADMIN_GROUPS.excerpts,
    useAsTitle: 'title',
    defaultColumns: ['title', 'billNumber', 'governmentLevel', 'billDate'],
    description: 'Legislation tracked via StateNet, summarized and categorized.',
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
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'billType',
                  label: 'Bill type',
                  type: 'select',
                  required: true,
                  options: ['Bill', 'Resolution', 'Amendment', 'Executive Order', 'Regulation'],
                },
                {
                  name: 'billNumber',
                  label: 'Bill number',
                  type: 'text',
                  required: true,
                  admin: { placeholder: 'H.1434' },
                },
              ],
            },
            {
              name: 'title',
              type: 'text',
              required: true,
            },
            {
              name: 'locations',
              label: 'Location',
              type: 'relationship',
              relationTo: 'locations',
              hasMany: true,
              required: true,
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'session',
                  label: 'Bill session',
                  type: 'text',
                  admin: { placeholder: 'Regular' },
                },
                {
                  name: 'governmentLevel',
                  label: 'Government level',
                  type: 'select',
                  required: true,
                  options: ['Federal', 'State/Province', 'Local', 'International'],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'billDate',
                  label: 'Bill date',
                  type: 'date',
                  required: true,
                },
                {
                  name: 'approvalDate',
                  label: 'Approval date',
                  type: 'date',
                },
                {
                  name: 'effectiveDate',
                  label: 'Effective date',
                  type: 'date',
                },
              ],
            },
            {
              name: 'lawNumber',
              label: 'Law number',
              type: 'text',
            },
            {
              name: 'carriedBy',
              label: 'Carried by',
              type: 'text',
              admin: { description: 'Sponsor.' },
            },
            {
              name: 'actionUrl',
              label: 'Action URL',
              type: 'text',
            },
            {
              name: 'billUrl',
              label: 'Bill URL',
              type: 'group',
              fields: [
                { name: 'title', type: 'text' },
                { name: 'url', type: 'text' },
              ],
            },
            {
              name: 'abstract',
              type: 'richText',
              required: true,
              access: {
                read: canReadFullContent,
              },
            },
            {
              name: 'fullText',
              label: 'Full text',
              type: 'richText',
              required: true,
              access: {
                read: canReadFullContent,
              },
            },
          ],
        },
        {
          label: 'Index',
          fields: [
            ...indexTermFields().filter((f) => !('name' in f && f.name === 'locations')),
            {
              name: 'relatedArticles',
              label: 'Related articles',
              type: 'relationship',
              relationTo: 'articles',
              hasMany: true,
            },
            {
              name: 'latestActivity',
              label: 'Latest activity',
              type: 'text',
              admin: { placeholder: 'Proposed Rule' },
            },
            {
              name: 'latestText',
              label: 'Latest text',
              type: 'text',
              admin: { placeholder: 'Proposed' },
            },
            {
              name: 'statusText',
              label: 'Status text',
              type: 'text',
              admin: { placeholder: 'Proposed Rule' },
            },
            {
              name: 'statute',
              label: 'Statute',
              type: 'group',
              admin: { description: 'Statute title / LexisNexis link.' },
              fields: [
                { name: 'title', type: 'text' },
                { name: 'url', type: 'text' },
              ],
            },
            {
              name: 'committee',
              label: 'Location (Committee)',
              type: 'text',
              admin: { placeholder: 'N/A' },
            },
            {
              name: 'actions',
              label: 'Bill actions',
              type: 'array',
              labels: { singular: 'Action', plural: 'Actions' },
              fields: [
                { name: 'date', type: 'date', required: true },
                { name: 'action', type: 'text', required: true, admin: { placeholder: 'Introduced by' } },
                { name: 'actor', type: 'text', admin: { placeholder: 'Gomez (D)' } },
              ],
            },
          ],
        },
      ],
    },
    ingestionField(),
  ],
}
