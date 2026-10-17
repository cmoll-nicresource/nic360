import type { CollectionConfig, CollectionSlug, Field } from 'payload'

import { requireBasePlanToRead, staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'
import { publicationGroupingRules } from '@/lib/publicationGrouping'

function includeExclude(name: string, relationTo: CollectionSlug): Field {
  return {
    name,
    type: 'group',
    fields: [
      { name: 'include', type: 'relationship', relationTo, hasMany: true },
      { name: 'exclude', type: 'relationship', relationTo, hasMany: true },
    ],
  }
}

export const Publications: CollectionConfig = {
  slug: 'publications',
  admin: {
    group: ADMIN_GROUPS.publishing,
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'format', 'frequency'],
    description: 'The newsletter itself, e.g. "US News Clippings". An Issue is one edition of it.',
  },
  access: {
    // Any subscriber can read (needed for the account-page preference picker too).
    read: requireBasePlanToRead,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (data && (data.format ?? originalDoc?.format) === 'excerpt-list')
          data.groupingRules = publicationGroupingRules({ ...originalDoc, ...data })
        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        if (doc.format === 'excerpt-list') doc.groupingRules = publicationGroupingRules(doc)
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea' },
    { name: 'thumbnail', type: 'upload', relationTo: 'media' },
    {
      name: 'category',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['news'],
      options: [
        { label: 'News', value: 'news' },
        { label: 'Legislation', value: 'legislation' },
        { label: 'Trademarks', value: 'trademarks' },
      ],
      admin: {
        description:
          "Which tracking categories this publication draws from — a publication can belong to more than one (e.g. an executive summary covering news and legislation). Groups this publication in the main nav's Publications dropdown and on the Publications page.",
      },
    },
    {
      name: 'format',
      type: 'select',
      required: true,
      defaultValue: 'excerpt-list',
      options: [
        { label: 'Excerpt list', value: 'excerpt-list' },
        { label: 'PDF report', value: 'pdf-report' },
        { label: 'Custom HTML', value: 'custom-html' },
      ],
    },
    {
      name: 'frequency',
      type: 'select',
      required: true,
      defaultValue: 'weekly',
      options: ['daily', 'weekly', 'monthly'],
    },
    {
      name: 'generator',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      admin: {
        description:
          'Manual for every publication except the automated trademark and trade-barometer reports.',
      },
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Weekly US Trademark Report', value: 'weekly-trademark-report' },
        { label: 'Monthly US Trademark Activity', value: 'monthly-trademark-activity' },
        { label: 'US Tobacco Trade Barometer', value: 'monthly-trade-barometer' },
      ],
    },
    {
      name: 'selectionRules',
      label: 'Selection rules',
      type: 'group',
      admin: {
        condition: (data) => data?.format === 'excerpt-list',
        description:
          'Builds use the saved issue date and published excerpts. Clippings are news only; US Clippings covers all products in the US, and Global Clippings requires a non-US location (mixed US/non-US stories qualify). Editors can adjust an issue afterward.',
      },
      fields: [
        {
          name: 'window',
          label: 'Window (days back)',
          type: 'number',
          min: 1,
          admin: {
            description:
              'Calendar days ending on and including the saved issue date, in Eastern time. Defaults from frequency if blank: 1/7/30.',
          },
        },
        {
          name: 'excerptTypes',
          type: 'select',
          hasMany: true,
          defaultValue: ['articles'],
          options: ['articles', 'bills', 'trademarks'],
        },
        includeExclude('locations', 'locations'),
        includeExclude('products', 'products'),
        includeExclude('sectors', 'sectors'),
        includeExclude('subjects', 'subjects'),
      ],
    },
    {
      name: 'groupingRules',
      label: 'Grouping rules',
      type: 'group',
      admin: {
        condition: (data) => data?.format === 'excerpt-list',
        description: 'Excerpts are grouped by continent, then primary subject. US News Clippings uses primary subject only. Item sorting remains adjustable.',
      },
      fields: [
        {
          name: 'groupBy',
          type: 'select',
          admin: { readOnly: true },
          defaultValue: 'none',
          options: [
            'none',
            { label: 'Continent', value: 'region' },
            'country',
            'primarySubject',
            'sector',
            'product',
            'excerptType',
          ],
        },
        {
          name: 'thenGroupBy',
          type: 'select',
          admin: { readOnly: true },
          options: [
            'none',
            { label: 'Continent', value: 'region' },
            'country',
            'primarySubject',
            'sector',
            'product',
            'excerptType',
          ],
        },
        {
          name: 'sortBy',
          type: 'select',
          defaultValue: 'sourceDateDesc',
          options: [
            { label: 'Source date (newest first)', value: 'sourceDateDesc' },
            { label: 'Source date (oldest first)', value: 'sourceDateAsc' },
            { label: 'Title', value: 'title' },
          ],
        },
      ],
    },
    {
      name: 'header',
      label: 'Header HTML',
      type: 'code',
      admin: {
        language: 'html',
        description:
          'Rendered before the tracking content / PDF download link in every issue (email and web). Trusted HTML (editor-role+ only), not sanitized further.',
      },
    },
    {
      name: 'footer',
      label: 'Footer HTML',
      type: 'code',
      admin: {
        language: 'html',
        description:
          'Rendered after the tracking content / PDF download link in every issue (email and web).',
      },
    },
    {
      name: 'mailchimp',
      type: 'group',
      fields: [
        {
          name: 'interestId',
          label: 'Interest ID',
          type: 'text',
          admin: {
            description:
              "This publication's checkbox in the audience's Publications interest group.",
          },
        },
        {
          name: 'segmentId',
          label: 'Segment ID',
          type: 'text',
          admin: { description: 'The saved segment ("Publications one of …") used when sending.' },
        },
      ],
    },
  ],
}
