import type { CollectionConfig } from 'payload'

import { anyoneCanRead, staffCanManageEvents } from '@/access/eventAccess'

export const Speakers: CollectionConfig = {
  slug: 'speakers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'company'],
    description: 'Shared across events; used for both moderators and speakers. Shows current role/company, including on past events.',
  },
  access: {
    read: anyoneCanRead,
    create: staffCanManageEvents,
    update: staffCanManageEvents,
    delete: staffCanManageEvents,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'text' },
    { name: 'company', type: 'text' },
    { name: 'headshot', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'textarea' },
  ],
}
