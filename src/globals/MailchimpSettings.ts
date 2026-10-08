import type { GlobalConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'

export const MailchimpSettings: GlobalConfig = {
  slug: 'mailchimp-settings',
  label: 'Mailchimp settings',
  access: {
    read: staffHasMinRole('editor'),
    update: staffHasMinRole('admin'),
  },
  fields: [
    {
      name: 'audienceId',
      label: 'Audience ID',
      type: 'text',
      admin: { description: 'The single Mailchimp audience, e.g. "Nicotine360 Publications".' },
    },
    {
      name: 'publicationsInterestCategoryId',
      label: 'Publications interest category ID',
      type: 'text',
      admin: { description: 'The "Publications" interest category; one interest per Publication.' },
    },
    {
      name: 'mode',
      type: 'text',
      virtual: true,
      admin: {
        readOnly: true,
        description: 'Set via the MAILCHIMP_MODE env var, not editable here.',
      },
      hooks: {
        afterRead: [() => process.env.MAILCHIMP_MODE || 'simulated'],
      },
    },
  ],
}
