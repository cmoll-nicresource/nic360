import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const EmailFlags: CollectionConfig = {
  slug: 'email-flags',
  labels: { singular: 'Email flag', plural: 'Email flags' },
  admin: {
    group: ADMIN_GROUPS.accounts,
    useAsTitle: 'id',
    defaultColumns: ['user', 'reason', 'status', 'occurredAt'],
    description: 'A queue of unsubscribes and delivery problems to follow up on.',
    components: {
      edit: {
        beforeDocumentControls: ['./components/admin/ReAddButton#ReAddButton'],
      },
    },
  },
  access: {
    read: staffHasMinRole('gatekeeper'),
    create: staffHasMinRole('gatekeeper'),
    update: staffHasMinRole('gatekeeper'),
    delete: staffHasMinRole('gatekeeper'),
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: [
        { label: 'Unsubscribed', value: 'unsubscribed' },
        { label: 'Spam complaint', value: 'spam complaint' },
        { label: 'Cleaned (bounces)', value: 'cleaned' },
      ],
    },
    { name: 'occurredAt', type: 'date', required: true },
    {
      name: 'publicationsBefore',
      type: 'relationship',
      relationTo: 'publications',
      hasMany: true,
      admin: { description: 'What they were receiving, so it can be restored.' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Following up', value: 'following up' },
        { label: 'Resolved', value: 'resolved' },
      ],
    },
    { name: 'notes', type: 'textarea' },
  ],
}
