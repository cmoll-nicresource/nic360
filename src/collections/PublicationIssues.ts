import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { requireBasePlanForPublished, staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'
import { staffHasMinRole } from '@/access/staffRoles'
import { preserveIssueStats } from '@/hooks/preserveIssueStats'
import { defaultIssueFields } from '@/hooks/defaultIssueFields'
import { defaultIssueDate } from '@/lib/publicationIssueTitle'

const protectNewsletterState: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  if (operation !== 'update' || req.context.newsletterSystem) return data
  if (originalDoc?.email?.status === 'sending')
    throw new Error('This issue is being sent. Wait for delivery to finish before editing it.')
  if (data.email && originalDoc?.email) {
    for (const key of [
      'provider',
      'campaignId',
      'status',
      'sentAt',
      'sentBy',
      'sendHtml',
      'sendSubject',
      'targetCount',
      'lastError',
      'sendAdIds',
      'adsRecorded',
    ])
      data.email[key] = originalDoc.email[key]
  }
  return data
}

export const PublicationIssues: CollectionConfig = {
  slug: 'publication-issues',
  defaultSort: '-issueDate',
  labels: { singular: 'Issue', plural: 'Issues' },
  admin: {
    group: ADMIN_GROUPS.publishing,
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'publication', 'issueDate', 'email'],
    components: {
      edit: {
        beforeDocumentControls: [
          './components/admin/SendIssueButtons#SendIssueButtons',
        ],
      },
    },
  },
  versions: { drafts: true },
  access: {
    read: requireBasePlanForPublished,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  hooks: {
    beforeValidate: [defaultIssueFields],
    beforeChange: [protectNewsletterState, preserveIssueStats],
  },
  fields: [
    {
      name: 'issuePreview',
      type: 'ui',
      admin: { components: { Field: './components/admin/IssuePreview#IssuePreview' } },
    },
    {
      type: 'row',
      fields: [
        { name: 'publication', type: 'relationship', relationTo: 'publications', required: true },
        {
          name: 'issueDate',
          type: 'date',
          required: true,
          defaultValue: () => defaultIssueDate(),
        },
      ],
    },
    {
      name: 'titleDefault',
      type: 'ui',
      admin: { components: { Field: './components/admin/IssueTitleDefault#IssueTitleDefault' } },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Suggested from the publication and issue date. You can enter a custom title.',
      },
    },
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

    {
      name: 'buildSections',
      type: 'ui',
      admin: {
        condition: (data) => data?.format === 'excerpt-list',
        components: { Field: './components/admin/BuildFromRulesButton#BuildFromRulesButton' },
      },
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
        description:
          'One group per section. "Build from rules" fills this in; reorder/edit freely after.',
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
      admin: { hidden: true },
      fields: [
        {
          name: 'subject',
          type: 'text',
          admin: { readOnly: true, description: 'Historical override retained for reference. Publication emails always use the issue title.' },
        },
        { name: 'previewText', label: 'Preview text', type: 'text' },
        {
          name: 'sendHtml',
          type: 'textarea',
          admin: { hidden: true },
          access: { read: staffHasMinRole('editor') },
        },
        {
          name: 'sendSubject',
          type: 'text',
          admin: { hidden: true },
          access: { read: staffHasMinRole('editor') },
        },
        { name: 'targetCount', type: 'number', admin: { readOnly: true } },
        { name: 'lastError', type: 'textarea', admin: { readOnly: true } },
        {
          name: 'sendAdIds',
          type: 'json',
          admin: { hidden: true },
          access: { read: staffHasMinRole('editor') },
        },
        {
          name: 'adsRecorded',
          type: 'checkbox',
          defaultValue: false,
          admin: { hidden: true },
          access: { read: staffHasMinRole('editor') },
        },
        {
          name: 'provider',
          type: 'select',
          admin: { readOnly: true, description: 'Which sender actually sent this issue.' },
          options: ['mailchimp', 'ses'],
        },
        {
          name: 'campaignId',
          label: 'Campaign/message ref',
          type: 'text',
          admin: {
            readOnly: true,
            description: 'Mailchimp campaign id, or the SES send batch, set when sent.',
          },
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
    {
      name: 'legacyId',
      type: 'text',
      index: true,
      access: {
        read: staffHasMinRole('admin'),
        create: staffHasMinRole('admin'),
        update: staffHasMinRole('admin'),
      },
      admin: {
        position: 'sidebar',
        description:
          "Old site's publications.id (the per-issue table, confusingly not publication_categories), for migration idempotency.",
      },
    },
    {
      name: 'deliverySummary',
      type: 'ui',
      admin: { components: { Field: './components/admin/IssueDeliverySummary#IssueDeliverySummary' } },
    },
    {
      name: 'stats',
      label: 'Delivery stats',
      type: 'group',
      admin: {
        hidden: true,
        description:
          'Engagement counts from verified SES events. Historical imported statistics are retained. See /admin/analytics for aggregate reporting.',
      },
      fields: [
        {
          name: 'recipientCount',
          label: 'Recipients',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true },
        },
        { name: 'delivered', type: 'number', defaultValue: 0, admin: { readOnly: true } },
        { name: 'opens', type: 'number', defaultValue: 0, admin: { readOnly: true } },
        { name: 'clicks', type: 'number', defaultValue: 0, admin: { readOnly: true } },
        { name: 'bounces', type: 'number', defaultValue: 0, admin: { readOnly: true } },
        { name: 'complaints', type: 'number', defaultValue: 0, admin: { readOnly: true } },
      ],
    },
  ],
}
