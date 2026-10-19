import type { CollectionConfig } from 'payload'
import { staffHasMinRole } from '@/access/staffRoles'
import { ADMIN_GROUPS } from '@/config/adminGroups'
export const Journals: CollectionConfig = {
  slug: 'journals',
  defaultSort: 'name',
  labels: { singular: 'Journal', plural: 'Journals' },
  admin: {
    group: ADMIN_GROUPS.taxonomy,
    useAsTitle: 'name',
    defaultColumns: ['name', 'homepage'],
  },
  access: {
    read: () => true,
    create: staffHasMinRole('admin'),
    update: staffHasMinRole('admin'),
    delete: staffHasMinRole('admin'),
  },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    {
      name: 'homepage',
      type: 'text',
      validate: (value: unknown) => {
        if (!value) return true
        try {
          return (
            new URL(String(value)).protocol === 'https:' ||
            'Use an HTTPS journal homepage.'
          )
        } catch {
          return 'Use an HTTPS journal homepage.'
        }
      },
    },
  ],
}
