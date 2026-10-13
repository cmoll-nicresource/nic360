import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const SesOutbox: CollectionConfig = {
  slug: 'ses-outbox',
  labels: { singular: 'SES send log entry', plural: 'SES outbox' },
  admin: {
    group: ADMIN_GROUPS.system,
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'issue', 'recipientCount', 'createdAt'],
    description:
      'Simulated SES sends. In simulated mode this is how a publication send gets reviewed — the full rendered HTML is logged here instead of being sent.',
  },
  access: {
    read: staffHasMinRole('editor'),
    create: staffHasMinRole('editor'),
    update: () => false, // an immutable log
    delete: staffHasMinRole('admin'),
  },
  fields: [
    { name: 'issue', type: 'relationship', relationTo: 'publication-issues' },
    { name: 'subject', type: 'text', required: true },
    { name: 'recipientCount', label: 'Recipient count', type: 'number', required: true },
    {
      name: 'html',
      type: 'code',
      admin: { language: 'html', description: 'The full rendered email HTML.' },
    },
  ],
}
