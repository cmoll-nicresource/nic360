import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'

export const TrademarkImportRuns: CollectionConfig = {
  slug: 'trademark-import-runs',
  labels: { singular: 'Trademark import run', plural: 'Trademark import runs' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['status', 'startedAt', 'finishedAt'],
    description: 'A log of each automated USPTO pull, so failures are visible.',
  },
  access: {
    read: staffHasMinRole('editor'),
    create: staffHasMinRole('gatekeeper'),
    update: staffHasMinRole('gatekeeper'),
    delete: staffHasMinRole('admin'),
  },
  fields: [
    { name: 'startedAt', type: 'date', required: true },
    { name: 'finishedAt', type: 'date' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'running',
      options: ['running', 'succeeded', 'failed'],
    },
    { name: 'feedSource', label: 'Feed source', type: 'text' },
    {
      name: 'counts',
      type: 'group',
      fields: [
        { name: 'new', type: 'number', defaultValue: 0 },
        { name: 'updated', type: 'number', defaultValue: 0 },
        { name: 'renewals', type: 'number', defaultValue: 0 },
        { name: 'cancellations', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'issuesCreated',
      label: 'Issues created',
      type: 'relationship',
      relationTo: 'publication-issues',
      hasMany: true,
    },
    { name: 'error', type: 'textarea' },
  ],
}
