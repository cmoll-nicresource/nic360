import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const TradeImportRuns: CollectionConfig = {
  slug: 'trade-import-runs',
  labels: { singular: 'Trade import run', plural: 'Trade import runs' },
  admin: {
    group: ADMIN_GROUPS.system,
    useAsTitle: 'id',
    defaultColumns: ['status', 'startedAt', 'finishedAt'],
    description: 'A log of each monthly Census trade file upload, so failures are visible.',
  },
  access: {
    read: staffHasMinRole('editor'),
    create: staffHasMinRole('editor'),
    update: staffHasMinRole('editor'),
    delete: staffHasMinRole('gatekeeper'),
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
    {
      name: 'files',
      type: 'group',
      fields: [
        { name: 'import', label: 'Import file', type: 'text' },
        { name: 'export', label: 'Export file', type: 'text' },
      ],
    },
    {
      name: 'counts',
      type: 'group',
      fields: [
        { name: 'importRows', label: 'Import rows loaded', type: 'number', defaultValue: 0 },
        { name: 'exportRows', label: 'Export rows loaded', type: 'number', defaultValue: 0 },
        { name: 'importReplaced', label: 'Import rows replaced', type: 'number', defaultValue: 0 },
        { name: 'exportReplaced', label: 'Export rows replaced', type: 'number', defaultValue: 0 },
        { name: 'newHtsCodes', label: 'New HTS codes added', type: 'number', defaultValue: 0 },
        { name: 'newCountries', label: 'New country codes added', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'dataQualityNotes',
      label: 'Data quality notes',
      type: 'array',
      admin: { description: 'Duplicate/overlap warnings, YTD checks and reference-code additions the loader surfaced.' },
      fields: [{ name: 'note', type: 'text', required: true }],
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
