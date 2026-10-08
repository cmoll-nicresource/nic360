import type { CollectionConfig } from 'payload'

import { requirePremiumToRead, staffCanManageData } from '@/access/dataAccess'

export const DatasetRows: CollectionConfig = {
  slug: 'dataset-rows',
  admin: {
    // Staff manage rows only through a dataset's "Import data" flow, never by hand here.
    hidden: true,
    useAsTitle: 'id',
  },
  access: {
    read: requirePremiumToRead,
    create: staffCanManageData,
    update: staffCanManageData,
    delete: staffCanManageData,
  },
  fields: [
    {
      name: 'dataset',
      type: 'relationship',
      relationTo: 'datasets',
      required: true,
      index: true,
    },
    {
      name: 'values',
      type: 'json',
      required: true,
    },
  ],
}
