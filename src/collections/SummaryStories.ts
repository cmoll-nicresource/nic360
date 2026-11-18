import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

/**
 * A Daily Executive Summary story: a copy of a Tobacco Reporter post, taken
 * when an editor adds it to an issue, so the archived issue keeps its text
 * even if the post later changes. Staff-only: subscribers read stories only
 * inside an issue (whose page checks the plan), never on their own, so there
 * is no news section for them.
 */
export const SummaryStories: CollectionConfig = {
  slug: 'summary-stories',
  labels: { singular: 'Executive Summary story', plural: 'Executive Summary stories' },
  defaultSort: '-publishedAt',
  admin: {
    group: ADMIN_GROUPS.publishing,
    useAsTitle: 'headline',
    defaultColumns: ['headline', 'heading', 'publishedAt', 'updatedAt'],
    description:
      'Copied from Tobacco Reporter when added to a Daily Executive Summary. Edit the article on Tobacco Reporter, then use "Refresh from Tobacco Reporter" on the issue.',
  },
  access: { read: staffCanWrite, create: staffCanWrite, update: staffCanWrite, delete: staffCanWrite },
  fields: [
    {
      name: 'headline',
      type: 'text',
      required: true,
      admin: { description: 'Shown in the Executive Summary. Starts as the Tobacco Reporter headline; change it here if needed.' },
    },
    {
      name: 'heading',
      label: 'Weekly heading',
      type: 'relationship',
      relationTo: 'summary-headings',
      admin: { description: 'Section of the weekly Executive Summary this story goes under. Not shown in the daily email.' },
    },
    {
      name: 'storyPreview',
      type: 'ui',
      admin: { components: { Field: './components/admin/summaryStories/StoryBodyPreview#StoryBodyPreview' } },
    },
    {
      name: 'bodyHtml',
      type: 'textarea',
      admin: { hidden: true },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: "Copied from the post's featured image. Remove it to send the story without an image." },
    },
    {
      name: 'sources',
      type: 'array',
      admin: { description: 'From the "Nicotine360 sources" box on Tobacco Reporter. Refreshing replaces this list.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true },
            {
              name: 'url',
              type: 'text',
              validate: (value: string | null | undefined) =>
                !value || /^https?:\/\//i.test(value) ? true : 'Must be a full http(s) link.',
            },
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      label: 'Published on Tobacco Reporter',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'wordpress',
      label: 'Tobacco Reporter',
      type: 'group',
      admin: { position: 'sidebar' },
      fields: [
        { name: 'postId', type: 'number', unique: true, index: true, admin: { readOnly: true } },
        { name: 'url', type: 'text', admin: { readOnly: true } },
        { name: 'headline', label: 'Original headline', type: 'text', admin: { readOnly: true } },
        { name: 'author', type: 'text', admin: { readOnly: true } },
        { name: 'imageUrl', type: 'text', admin: { hidden: true } },
        { name: 'modifiedAt', label: 'Last edited there', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'copiedAt', label: 'Copied here', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
  ],
}
