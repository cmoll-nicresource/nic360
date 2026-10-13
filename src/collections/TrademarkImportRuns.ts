import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const TrademarkImportRuns: CollectionConfig = {
  slug: 'trademark-import-runs',
  labels: { singular: 'Trademark import run', plural: 'Trademark import runs' },
  admin: {
    group: ADMIN_GROUPS.system,
    useAsTitle: 'id',
    defaultColumns: ['issueDate', 'status', 'startedAt', 'finishedAt'],
    description: 'A log of each automated USPTO pull, so failures are visible.',
  },
  access: {
    read: staffHasMinRole('editor'),
    create: staffHasMinRole('gatekeeper'),
    update: staffHasMinRole('gatekeeper'),
    delete: staffHasMinRole('admin'),
  },
  fields: [
    {
      name: 'issueDate',
      label: 'TMOG issue date',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: "The Gazette issue (always a Tuesday) this run processed. Used to skip issues that already succeeded.",
      },
    },
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
        { name: 'published', label: 'Published (kept)', type: 'number', defaultValue: 0 },
        { name: 'registered', label: 'Registered (kept)', type: 'number', defaultValue: 0 },
        { name: 'renewals', type: 'number', defaultValue: 0 },
        { name: 'cancellations', type: 'number', defaultValue: 0 },
        { name: 'imagesSaved', label: 'Images saved', type: 'number', defaultValue: 0 },
        { name: 'imagesMissing', label: 'Images missing (404)', type: 'number', defaultValue: 0 },
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
