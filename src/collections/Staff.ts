import type { CollectionConfig } from 'payload'

import { staffHasMinRole, staffHasRole } from '@/access/staffRoles'

export const Staff: CollectionConfig = {
  slug: 'staff',
  labels: {
    singular: 'Staff member',
    plural: 'Staff',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    description: 'The Nic360 employees who can log in to this admin panel.',
  },
  auth: true,
  access: {
    read: staffHasMinRole('editor'),
    create: staffHasMinRole('admin'),
    update: ({ req, id }) => {
      if (staffHasRole(req.user, 'admin')) return true
      return req.user?.collection === 'staff' && req.user.id === id
    },
    delete: staffHasMinRole('admin'),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Editor', value: 'editor' },
        { label: 'Gatekeeper', value: 'gatekeeper' },
        { label: 'Admin', value: 'admin' },
      ],
      access: {
        // Only an admin can change a staff member's own or anyone else's role.
        update: staffHasMinRole('admin'),
      },
    },
  ],
}
