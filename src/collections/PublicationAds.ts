import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'
import { isValidAdWindow } from '@/lib/publicationAds'

export const PublicationAds: CollectionConfig = {
  slug: 'publication-ads',
  labels: { singular: 'Publication Ad', plural: 'Publication Ads' },
  admin: {
    group: ADMIN_GROUPS.publishing,
    useAsTitle: 'advertiser',
    defaultColumns: ['advertiser', 'publication', 'rank', 'startDate', 'endDate'],
    description:
      'Image ads sold per publication. While its campaign is active, a ranked ad rotates into the slot before story 1, 3, 5… of every issue sent (rank 1 fills the earliest slot).',
  },
  access: {
    read: staffCanWrite,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
  },
  fields: [
    {
      name: 'advertiser',
      type: 'text',
      required: true,
      admin: { description: "Internal label (the sponsor's name) — not shown to readers." },
    },
    { name: 'publication', type: 'relationship', relationTo: 'publications', required: true },
    {
      type: 'row',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        {
          name: 'link',
          label: 'Click-through link',
          type: 'text',
          required: true,
          validate: (value: string | null | undefined) => {
            if (!value) return 'A click-through link is required.'
            return value.startsWith('http://') || value.startsWith('https://') ? true : 'Must be a full http(s) URL.'
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'rank',
          type: 'number',
          required: true,
          admin: { description: 'Lower rank fills the earlier slot (before story 1, then 3, then 5…).' },
        },
        { name: 'startDate', type: 'date', required: true },
        {
          name: 'endDate',
          type: 'date',
          required: true,
          validate: (
            value: Date | string | null | undefined,
            { siblingData }: { siblingData: { startDate?: Date | string | null } },
          ) => {
            if (!value || !siblingData?.startDate) return true
            return isValidAdWindow(siblingData.startDate, value) ? true : 'End date must be on or after the start date.'
          },
        },
      ],
    },
    {
      name: 'stats',
      type: 'group',
      admin: {
        position: 'sidebar',
        description:
          'Filled in automatically. "Impressions" counts issue sends this ad was placed in (not reader-level opens — Mailchimp doesn\'t give us per-recipient delivery counts the way SES does).',
      },
      fields: [
        { name: 'impressions', type: 'number', defaultValue: 0, admin: { readOnly: true } },
        { name: 'clicks', type: 'number', defaultValue: 0, admin: { readOnly: true } },
      ],
    },
  ],
}
