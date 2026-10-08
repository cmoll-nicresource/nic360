import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { requireBasePlanToRead, staffCanWrite } from '@/access/excerptAccess'

const defaultFormatFromPublication: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (operation !== 'create' || data.format || !data.publication) return data
  const publication = await req.payload
    .findByID({ collection: 'publications', id: data.publication, depth: 0, req })
    .catch(() => null)
  if (publication) data.format = publication.format
  return data
}

export const PublicationIssues: CollectionConfig = {
  slug: 'publication-issues',
  labels: { singular: 'Issue', plural: 'Issues' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publication', 'issueDate', 'email'],
    components: {
      edit: {
        beforeDocumentControls: [
          './components/admin/BuildFromRulesButton#BuildFromRulesButton',
          './components/admin/SendIssueButtons#SendIssueButtons',
        ],
      },
    },
  },
  versions: { drafts: true },
  access: {
    read: requireBasePlanToRead,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  hooks: {
    beforeChange: [defaultFormatFromPublication],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'publication', type: 'relationship', relationTo: 'publications', required: true },
        { name: 'issueDate', type: 'date', required: true, defaultValue: () => new Date().toISOString() },
      ],
    },
    { name: 'title', type: 'text', required: true },
    {
      name: 'format',
      type: 'select',
      required: true,
      options: [
        { label: 'Excerpt list', value: 'excerpt-list' },
        { label: 'PDF report', value: 'pdf-report' },
        { label: 'Custom HTML', value: 'custom-html' },
      ],
    },

    // Excerpt list
    {
      name: 'intro',
      type: 'richText',
      admin: { condition: (data) => data?.format === 'excerpt-list' },
    },
    {
      name: 'sections',
      type: 'array',
      admin: {
        condition: (data) => data?.format === 'excerpt-list',
        description: 'One group per section. "Build from rules" fills this in; reorder/edit freely after.',
      },
      fields: [
        { name: 'heading', type: 'text', required: true },
        {
          name: 'items',
          type: 'relationship',
          relationTo: ['articles', 'bills', 'trademarks'],
          hasMany: true,
        },
      ],
    },

    // PDF report
    {
      name: 'summary',
      type: 'richText',
      admin: { condition: (data) => data?.format === 'pdf-report' },
    },
    {
      name: 'file',
      label: 'PDF file',
      type: 'upload',
      relationTo: 'guide-files',
      admin: { condition: (data) => data?.format === 'pdf-report' },
    },

    // Custom HTML
    {
      name: 'body',
      type: 'code',
      admin: {
        language: 'html',
        condition: (data) => data?.format === 'custom-html',
        description: 'Sanitized HTML, designed outside the CMS.',
      },
    },

    {
      name: 'email',
      type: 'group',
      fields: [
        {
          name: 'subject',
          type: 'text',
          admin: { description: 'Defaults to the issue title if left blank.' },
        },
        { name: 'previewText', label: 'Preview text', type: 'text' },
        {
          name: 'campaignId',
          type: 'text',
          admin: { readOnly: true, description: 'Set when the campaign is created.' },
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'not sent',
          admin: { readOnly: true },
          options: ['not sent', 'sending', 'sent', 'failed'],
        },
        { name: 'sentAt', type: 'date', admin: { readOnly: true } },
        { name: 'sentBy', type: 'relationship', relationTo: 'staff', admin: { readOnly: true } },
      ],
    },
  ],
}
