import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'
import { ACCOUNT_EMAIL_KINDS } from '@/lib/accountEmailLog'

/**
 * A record of every password, invitation, signup and confirmation email the site
 * sends, so staff can answer "I never got it". Rows are written by the email
 * adapter (src/lib/loggedEmailAdapter.ts) and updated by SES delivery events;
 * nobody edits them by hand.
 */
export const AccountEmails: CollectionConfig = {
  slug: 'account-emails',
  labels: { singular: 'Account email', plural: 'Account emails' },
  defaultSort: '-createdAt',
  admin: {
    group: ADMIN_GROUPS.accounts,
    useAsTitle: 'subject',
    defaultColumns: ['recipient', 'kind', 'status', 'stuck', 'createdAt'],
    description:
      'Every account email the site sends, with its delivery status. Open a row to see the message and, while its link still works, copy it to send another way.',
  },
  access: {
    read: staffHasMinRole('gatekeeper'),
    create: () => false,
    update: () => false,
    delete: staffHasMinRole('admin'),
  },
  fields: [
    {
      name: 'preview',
      type: 'ui',
      admin: { components: { Field: './components/admin/AccountEmailPreview#AccountEmailPreview' } },
    },
    {
      type: 'row',
      fields: [
        { name: 'recipient', type: 'text', required: true, index: true, admin: { readOnly: true } },
        {
          name: 'kind',
          type: 'select',
          required: true,
          options: [...ACCOUNT_EMAIL_KINDS],
          admin: { readOnly: true },
        },
      ],
    },
    { name: 'subject', type: 'text', required: true, admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'sent',
          options: [
            { label: 'Handed to the mail service', value: 'sent' },
            { label: 'Delivered', value: 'delivered' },
            { label: 'Bounced', value: 'bounced' },
            { label: 'Complaint', value: 'complained' },
            { label: 'Failed to send', value: 'failed' },
          ],
          admin: {
            readOnly: true,
            description:
              '“Delivered” means the recipient’s mail server accepted it, not that a person saw it. Corporate filters can still hold or hide accepted mail.',
          },
        },
        { name: 'statusAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      name: 'stuck',
      label: 'Likely not receiving email',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        readOnly: true,
        description: 'This was the second or later message to this address within 24 hours.',
      },
    },
    { name: 'linkExpiresAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'messageId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'error', type: 'text', admin: { readOnly: true } },
    { name: 'note', type: 'text', admin: { readOnly: true } },
    {
      name: 'issuedBy',
      label: 'Issued by',
      type: 'relationship',
      relationTo: 'staff',
      admin: { readOnly: true, condition: (data) => data?.kind === 'staff-link' },
    },
    {
      name: 'html',
      label: 'Message',
      type: 'textarea',
      admin: { hidden: true },
    },
  ],
}
