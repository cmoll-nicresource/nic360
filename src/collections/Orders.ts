import type { Access, CollectionConfig } from 'payload'

import { staffCanManageRegistrations } from '@/access/eventAccess'
import { staffHasRole } from '@/access/staffRoles'

const readOwnOrManaged: Access = ({ req }) => {
  if (staffHasRole(req.user, 'gatekeeper')) return true
  if (req.user?.collection === 'users') return { buyer: { equals: req.user.id } }
  return false
}

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['buyer', 'event', 'status', 'total', 'createdAt'],
    description: 'One checkout by one buyer, which can include tickets for colleagues.',
  },
  access: {
    read: readOwnOrManaged,
    // Created by the Stripe checkout route (overrideAccess), not directly by readers.
    create: staffCanManageRegistrations,
    update: staffCanManageRegistrations,
    delete: staffCanManageRegistrations,
  },
  fields: [
    { name: 'buyer', type: 'relationship', relationTo: 'users', required: true },
    { name: 'event', type: 'relationship', relationTo: 'events', required: true },
    { name: 'registrations', type: 'join', collection: 'event-registrations', on: 'order' },
    { name: 'discountCode', label: 'Discount code', type: 'relationship', relationTo: 'discount-codes' },
    {
      type: 'row',
      fields: [
        { name: 'subtotal', type: 'number', required: true },
        { name: 'discount', type: 'number', required: true, defaultValue: 0 },
        { name: 'total', type: 'number', required: true },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'paid', 'cancelled', 'refunded'],
    },
    { name: 'paidAt', type: 'date' },
    { name: 'paymentRef', label: 'Payment reference', type: 'text' },
  ],
}
