import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'

export const Countries: CollectionConfig = {
  slug: 'countries',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'iso2', 'iso3'],
    description: 'Reference list so dataset "country" columns show flags and names consistently.',
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
      name: 'iso2',
      label: 'ISO 2-letter code',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'iso3',
      label: 'ISO 3-letter code',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'aliases',
      type: 'array',
      admin: {
        description: 'Alternate names matched against spreadsheet values on import, e.g. USA, United States of America.',
      },
      fields: [{ name: 'alias', type: 'text', required: true }],
    },
  ],
}
