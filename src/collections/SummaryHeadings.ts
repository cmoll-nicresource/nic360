import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

/** The informal section headings of the weekly Executive Summary PDF, in running order. */
export const SummaryHeadings: CollectionConfig = {
  slug: 'summary-headings',
  labels: { singular: 'Executive Summary heading', plural: 'Executive Summary headings' },
  orderable: true,
  admin: {
    group: ADMIN_GROUPS.publishing,
    useAsTitle: 'title',
    defaultColumns: ['title'],
    description:
      'Sections of the weekly Executive Summary, in the order they appear. Drag to reorder. Each Daily Executive Summary story is filed under one of these; they are not shown in the daily email.',
  },
  access: { read: staffCanWrite, create: staffCanWrite, update: staffCanWrite, delete: staffCanWrite },
  fields: [{ name: 'title', type: 'text', required: true, unique: true }],
}
