import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Locations: CollectionConfig = {
  slug: 'locations',
  admin: {
    group: ADMIN_GROUPS.taxonomy,
    useAsTitle: 'name',
    defaultColumns: ['name', 'level', 'parent'],
    description:
      'One record per place, reused. Hierarchy (e.g. Pennsylvania > United States > North America) lets rules and filters match a place and everything inside it.',
  },
  access: {
    read: () => true,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'level',
      type: 'select',
      required: true,
      options: [
        { label: 'Region', value: 'region' },
        { label: 'Country', value: 'country' },
        { label: 'State/Province', value: 'state' },
        { label: 'City', value: 'city' },
      ],
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'locations',
      admin: {
        description: 'E.g. Pennsylvania\'s parent is United States, whose parent is North America.',
      },
    },
    {
      name: 'geo',
      label: 'Coordinates',
      type: 'group',
      admin: {
        description: 'Fed by the address autocomplete when staff add a location.',
      },
      fields: [
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
      ],
    },
  ],
}
