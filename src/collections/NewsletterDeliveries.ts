import type { CollectionConfig } from 'payload'
import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const NewsletterDeliveries: CollectionConfig = {
  slug: 'newsletter-deliveries',
  labels: { singular: 'Publication Delivery', plural: 'Publication Deliveries' },
  admin: {
    group: ADMIN_GROUPS.system,
    useAsTitle: 'recipientEmail',
    defaultColumns: ['issue', 'recipientEmail', 'status', 'providerMessageId', 'updatedAt'],
    description:
      'SES delivery attempts. Unknown means SES may have accepted the message; it is never resent automatically.',
  },
  access: {
    read: staffHasMinRole('editor'),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'deliveryKey', type: 'text', required: true, unique: true },
    { name: 'issue', type: 'relationship', relationTo: 'publication-issues', index: true },
    { name: 'user', type: 'relationship', relationTo: 'users' },
    { name: 'recipientEmail', type: 'email', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      options: ['queued', 'sending', 'sent', 'failed', 'unknown', 'skipped'],
    },
    { name: 'providerMessageId', type: 'text', index: true },
    { name: 'lastError', type: 'textarea' },
  ],
}
