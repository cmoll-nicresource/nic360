import type { CollectionConfig } from 'payload'
import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'
export const SesEvents: CollectionConfig = {
  slug: 'ses-events',
  admin: {
    group: ADMIN_GROUPS.system,
    useAsTitle: 'eventKey',
    defaultColumns: ['kind', 'messageId', 'isTest', 'createdAt'],
    description:
      'Verified SNS events, processed once. Test events do not change audience preferences or issue statistics.',
  },
  access: {
    read: staffHasMinRole('admin'),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'eventKey', type: 'text', required: true, unique: true },
    { name: 'kind', type: 'text', required: true },
    { name: 'messageId', type: 'text' },
    { name: 'isTest', type: 'checkbox', defaultValue: false },
  ],
}
