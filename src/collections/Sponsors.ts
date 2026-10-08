import type { CollectionConfig } from 'payload'

import { anyoneCanRead, staffCanManageEvents } from '@/access/eventAccess'

export const Sponsors: CollectionConfig = {
  slug: 'sponsors',
  admin: {
    useAsTitle: 'name',
    description: 'One shared pool, assigned to events. No sponsor levels — all sponsors of an event display the same way.',
  },
  access: {
    read: anyoneCanRead,
    create: staffCanManageEvents,
    update: staffCanManageEvents,
    delete: staffCanManageEvents,
  },
  fields: [
    { name: 'name', label: 'Company', type: 'text', required: true },
    { name: 'logo', type: 'upload', relationTo: 'media', required: true },
    { name: 'description', type: 'richText', required: true },
    { name: 'website', type: 'text' },
    {
      name: 'events',
      type: 'join',
      collection: 'events',
      on: 'sponsors',
      admin: { description: 'Reverse of each event\'s Sponsors field.' },
    },
  ],
}
