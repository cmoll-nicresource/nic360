import type { CollectionConfig, CollectionSlug, Field } from 'payload'

import { requireBasePlanToRead, staffCanWrite } from '@/access/excerptAccess'

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
    useAsTitle: 'title',
    defaultColumns: ['title', 'format', 'frequency'],
    description: 'The newsletter itself, e.g. "US News Clippings". An Issue is one edition of it.',
  },
  access: {
    // Any subscriber can read (needed for the account-page preference picker too).
    read: requireBasePlanToRead,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea' },
    { name: 'thumbnail', type: 'upload', relationTo: 'media' },
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
        description: 'Manual for every publication except the two automated trademark reports.',
      },
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Weekly US Trademark Report', value: 'weekly-trademark-report' },
        { label: 'Monthly US Trademark Activity', value: 'monthly-trademark-activity' },
      ],
    },
    {
      name: 'selectionRules',
      label: 'Selection rules',
      type: 'group',
      admin: {
        condition: (data) => data?.format === 'excerpt-list',
        description: 'Defaults for building an issue; editors can still adjust each issue afterward.',
      },
      fields: [
        {
          name: 'window',
          label: 'Window (days back)',
          type: 'number',
          admin: { description: 'Defaults from frequency if left blank: 1/7/30.' },
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
      },
      fields: [
        {
          name: 'groupBy',
          type: 'select',
          defaultValue: 'none',
          options: ['none', 'region', 'country', 'primarySubject', 'sector', 'product', 'excerptType'],
        },
        {
          name: 'thenGroupBy',
          type: 'select',
          options: ['none', 'region', 'country', 'primarySubject', 'sector', 'product', 'excerptType'],
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
      name: 'mailchimp',
      type: 'group',
      fields: [
        {
          name: 'interestId',
          label: 'Interest ID',
          type: 'text',
          admin: { description: "This publication's checkbox in the audience's Publications interest group." },
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
