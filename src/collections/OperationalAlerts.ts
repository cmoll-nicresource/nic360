import type { CollectionConfig } from 'payload'
import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const OperationalAlerts: CollectionConfig = {
  slug: 'operational-alerts',
  admin: {
    group: ADMIN_GROUPS.system,
    useAsTitle: 'title',
    defaultColumns: ['title', 'resolved', 'lastSeenAt', 'notifiedAt', 'notificationError'],
    description:
      'Automatic checks every five minutes. Alerts clear when the underlying condition is fixed. Email notifications are deduplicated.',
  },
  access: {
    read: staffHasMinRole('editor'),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'alertKey', type: 'text', required: true, unique: true },
    { name: 'title', type: 'text', required: true },
    { name: 'message', type: 'textarea', required: true },
    { name: 'sourcePath', type: 'text', required: true },
    { name: 'resolved', type: 'checkbox', defaultValue: false, index: true },
    { name: 'lastSeenAt', type: 'date', required: true },
    { name: 'notifiedAt', type: 'date' },
    { name: 'notificationAttemptedAt', type: 'date' },
    { name: 'notificationError', type: 'textarea' },
  ],
}
