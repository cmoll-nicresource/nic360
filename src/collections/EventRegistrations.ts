import type { Access, CollectionConfig, Where } from 'payload'

import { staffCanManageRegistrations } from '@/access/eventAccess'
import { staffHasRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'

const readOwnOrManaged: Access = ({ req }) => {
  if (staffHasRole(req.user, 'gatekeeper')) return true
  if (req.user?.collection === 'users') {
    const or: Where[] = [{ attendee: { equals: req.user.id } }, { 'order.buyer': { equals: req.user.id } }]
    return { or }
  }
  return false
}

export const EventRegistrations: CollectionConfig = {
  slug: 'event-registrations',
  labels: { singular: 'Event registration', plural: 'Event registrations' },
  admin: {
    group: ADMIN_GROUPS.events,
    useAsTitle: 'id',
    defaultColumns: ['event', 'attendeeName', 'ticketType', 'status'],
    description: 'One ticket for one attendee.',
  },
  access: {
    read: readOwnOrManaged,
    create: staffCanManageRegistrations,
    update: staffCanManageRegistrations,
    delete: staffCanManageRegistrations,
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'event', type: 'relationship', relationTo: 'events', required: true },
    {
      name: 'attendee',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Set once the attendee has an account.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'attendeeName', label: 'Attendee name', type: 'text', required: true },
        { name: 'attendeeEmail', label: 'Attendee email', type: 'email', required: true },
      ],
    },
    { name: 'ticketType', label: 'Ticket type', type: 'text', required: true },
    {
      name: 'attendance',
      type: 'select',
      required: true,
      options: [
        { label: 'In person', value: 'in-person' },
        { label: 'Virtual', value: 'virtual' },
      ],
    },
    {
      name: 'priceBasis',
      label: 'Price basis',
      type: 'select',
      required: true,
      defaultValue: 'standard',
      options: ['standard', 'subscriber'],
    },
    { name: 'amountPaid', label: 'Amount paid', type: 'number', required: true },
    {
      name: 'discountCode',
      label: 'Discount code',
      type: 'relationship',
      relationTo: 'discount-codes',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: ['active', 'cancelled'],
    },
  ],
}
