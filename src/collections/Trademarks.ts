import type { CollectionConfig } from 'payload'

import { requireBasePlanToRead, staffCanWrite } from '@/access/excerptAccess'
import { ingestionField } from '@/fields/ingestion'
import { ADMIN_GROUPS } from '@/config/adminGroups'

const yesNoNA = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
  { label: 'N/A', value: 'na' },
]

export const Trademarks: CollectionConfig = {
  slug: 'trademarks',
  admin: {
    group: ADMIN_GROUPS.excerpts,
    useAsTitle: 'title',
    defaultColumns: ['title', 'serialNumber', 'owner', 'publishedDate'],
    description: 'Scraped weekly from the USPTO XML feed: filings, renewals, cancellations.',
  },
  versions: {
    drafts: true,
  },
  access: {
    // No public teaser for trademarks: the whole document requires a plan.
    read: requireBasePlanToRead,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  fields: [
    {
      name: 'title',
      label: 'Brand name',
      type: 'text',
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'serialNumber',
          label: 'Serial number',
          type: 'text',
          unique: true,
          admin: { description: 'Proposed key for USPTO upsert.' },
        },
        {
          name: 'class',
          label: 'Class',
          type: 'text',
          admin: { description: 'Nice classification.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'owner',
          label: 'Company',
          type: 'text',
        },
        {
          name: 'ownerAddress',
          label: 'Address',
          type: 'text',
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'style',
          type: 'select',
          options: yesNoNA,
        },
        {
          name: 'design',
          type: 'select',
          options: yesNoNA,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'publishedDate', label: 'Published date', type: 'date' },
        { name: 'firstUsedDate', label: 'First used date', type: 'date' },
        { name: 'commercialUseDate', label: 'Commercial use date', type: 'date' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'filedDate', label: 'Filed date', type: 'date' },
        { name: 'registeredDate', label: 'Registered date', type: 'date' },
        { name: 'registrationNumber', label: 'Registered number', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'cancelledDate', label: 'Cancelled date', type: 'date' },
        { name: 'renewedDate', label: 'Renewed date', type: 'date' },
      ],
    },
    {
      name: 'renewal',
      type: 'group',
      fields: [
        { name: 'owner', label: 'Renewed owner', type: 'text' },
        { name: 'address', label: 'Renewed address', type: 'text' },
      ],
    },
    {
      name: 'image',
      label: 'Trademark image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    ingestionField(),
  ],
}
