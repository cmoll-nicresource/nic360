import type { CollectionConfig } from 'payload'

import { staffHasMinRole } from '@/access/staffRoles'

export const AccessProviders: CollectionConfig = {
  slug: 'access-providers',
  labels: {
    singular: 'Access provider',
    plural: 'Access providers',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'plan', 'status', 'licenseExpiresAt'],
    description: "The employer organizations whose subscriptions members inherit.",
  },
  access: {
    read: staffHasMinRole('editor'),
    create: staffHasMinRole('gatekeeper'),
    update: staffHasMinRole('gatekeeper'),
    delete: staffHasMinRole('admin'),
  },
  fields: [
    {
      name: 'name',
      label: 'Company name',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Trial', value: 'trial' },
        { label: 'Live', value: 'live' },
      ],
    },
    {
      name: 'plan',
      type: 'select',
      required: true,
      defaultValue: 'none',
      admin: {
        description: 'Premium includes everything in Base. Staff set this even for trials.',
      },
      options: [
        { label: 'None', value: 'none' },
        { label: 'Base', value: 'base' },
        { label: 'Premium', value: 'premium' },
      ],
    },
    {
      name: 'licenseExpiresAt',
      label: 'License expiry date',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'Leave blank for no expiry. Past this date, the provider grants no access.',
      },
    },
    {
      name: 'allowedDomains',
      label: 'Allowed domain(s)',
      type: 'array',
      admin: {
        description:
          'Email domains (itc.in) or exact addresses. A reader who verifies a matching email is attached to this provider automatically.',
      },
      fields: [
        {
          name: 'domain',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'users',
      label: 'User(s)',
      type: 'join',
      collection: 'users',
      on: 'accessProvider',
      admin: {
        description: 'Reverse of each user\'s Access Provider field. Edit this from the user.',
      },
    },
  ],
}
