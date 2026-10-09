import type { CollectionConfig } from 'payload'

import { staffCanManageRegistrations } from '@/access/eventAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const DiscountCodes: CollectionConfig = {
  slug: 'discount-codes',
  labels: { singular: 'Discount code', plural: 'Discount codes' },
  admin: {
    group: ADMIN_GROUPS.events,
    useAsTitle: 'code',
    defaultColumns: ['code', 'event', 'percentOff', 'maxUses'],
    description: 'Given to certain companies for 25-100% off a set number of tickets.',
  },
  access: {
    read: staffCanManageRegistrations,
    create: staffCanManageRegistrations,
    update: staffCanManageRegistrations,
    delete: staffCanManageRegistrations,
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'event', type: 'relationship', relationTo: 'events', required: true },
    {
      name: 'accessProvider',
      label: 'Access provider',
      type: 'relationship',
      relationTo: 'access-providers',
      admin: { description: 'The company it was given to.' },
    },
    {
      name: 'percentOff',
      label: 'Percent off',
      type: 'number',
      required: true,
      min: 1,
      max: 100,
      admin: { description: '100 = comped ticket.' },
    },
    {
      name: 'maxUses',
      label: 'Max uses',
      type: 'number',
      required: true,
      admin: { description: 'The given number of tickets; each ticket uses one.' },
    },
    {
      name: 'uses',
      type: 'join',
      collection: 'event-registrations',
      on: 'discountCode',
      admin: { description: 'Count = tickets used so far.' },
    },
    {
      name: 'ticketTypes',
      label: 'Limit to ticket type(s)',
      type: 'array',
      admin: { description: 'Leave empty to allow any ticket type on the event.' },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    { name: 'expiresAt', type: 'date' },
  ],
}
