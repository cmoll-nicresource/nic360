import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const MailchimpOutbox: CollectionConfig = {
  slug: 'mailchimp-outbox',
  labels: {
    singular: 'Outbox entry',
    plural: 'Mailchimp outbox',
  },
  admin: {
    group: ADMIN_GROUPS.system,
    useAsTitle: 'type',
    defaultColumns: ['type', 'segment', 'createdAt'],
    description:
      'Simulated Mailchimp calls. In simulated mode this is how campaigns get reviewed — the full rendered HTML and target segment are logged here instead of being sent.',
  },
  access: {
    read: staffHasMinRole('editor'),
    create: staffHasMinRole('editor'),
    update: () => false, // an immutable log
    delete: staffHasMinRole('admin'),
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: ['upsertMember', 'createCampaign', 'sendCampaign', 'sendTest'],
    },
    {
      name: 'segment',
      type: 'text',
      admin: { description: 'The target audience segment, or recipient for a test send.' },
    },
    {
      name: 'payload',
      type: 'json',
      required: true,
    },
    {
      name: 'html',
      type: 'code',
      admin: {
        language: 'html',
        description: 'The full rendered campaign HTML, for createCampaign and sendTest entries.',
      },
    },
  ],
}
