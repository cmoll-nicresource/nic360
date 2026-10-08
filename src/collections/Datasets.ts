import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { staffCanManageData } from '@/access/dataAccess'

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

type ColumnRow = { label: string; key?: string }

const fillColumnKeys: CollectionBeforeChangeHook = ({ data }) => {
  if (!Array.isArray(data?.columns)) return data
  data.columns = (data.columns as ColumnRow[]).map((col) => ({
    ...col,
    // `key` is generated from the label once and then stable, so renaming a
    // label never breaks rows already stored under that key.
    key: col.key || slugifyKey(col.label || ''),
  }))
  return data
}

export const Datasets: CollectionConfig = {
  slug: 'datasets',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug'],
    description: 'Staff-defined flat tables: define columns, then import a spreadsheet of rows.',
    components: {
      edit: {
        beforeDocumentControls: ['./components/admin/ImportDataLink#ImportDataLink'],
      },
    },
  },
  access: {
    read: () => true, // listing/cards are public; row data itself is gated (see dataset-rows)
    create: staffCanManageData,
    update: staffCanManageData,
    delete: staffCanManageData,
  },
  hooks: {
    beforeChange: [fillColumnKeys],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'An emoji or short icon name shown on the dataset card.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'columns',
      label: 'Data headers',
      type: 'array',
      required: true,
      labels: { singular: 'Column', plural: 'Columns' },
      admin: {
        description: 'Order here is the grid column order.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true },
            {
              name: 'key',
              type: 'text',
              admin: {
                readOnly: true,
                description: 'Generated from the label. Rows store values under this key.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'type',
              type: 'select',
              required: true,
              defaultValue: 'text',
              options: ['text', 'number', 'percent', 'year', 'date', 'country', 'link'],
            },
            { name: 'filterable', type: 'checkbox', defaultValue: true },
            { name: 'sortable', type: 'checkbox', defaultValue: true },
            {
              name: 'defaultSort',
              type: 'select',
              defaultValue: 'none',
              options: ['none', 'asc', 'desc'],
            },
          ],
        },
      ],
    },
    {
      name: 'lastImport',
      label: 'Data mapping',
      type: 'group',
      admin: {
        description: 'Set automatically by the import flow — see "Import data" on this document.',
      },
      fields: [
        {
          name: 'file',
          type: 'upload',
          relationTo: 'media',
          admin: { readOnly: true },
        },
        {
          name: 'mapping',
          type: 'json',
          admin: { readOnly: true, description: 'Spreadsheet header -> column key.' },
        },
        {
          name: 'importedAt',
          type: 'date',
          admin: { readOnly: true },
        },
        {
          name: 'rowCount',
          type: 'number',
          admin: { readOnly: true },
        },
      ],
    },
  ],
}
