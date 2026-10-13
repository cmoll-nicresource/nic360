import type { CollectionConfig } from 'payload'

import { staffCanWrite } from '@/access/excerptAccess'
import { canReadGuide } from '@/access/guidesAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Guides: CollectionConfig = {
  slug: 'guides',
  admin: {
    group: ADMIN_GROUPS.publishing,
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'requiresPremium'],
  },
  versions: {
    drafts: true,
  },
  access: {
    // No public teaser. Most guides require Premium; requiresPremium=false
    // opts a specific guide into Base access too — a real exception, not
    // the default (see canReadGuide).
    read: canReadGuide,
    create: staffCanWrite,
    update: staffCanWrite,
    delete: staffCanWrite,
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
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'guide-files',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'requiresPremium',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Most guides require Premium. Turn this off for the handful open to Base subscribers too.',
      },
    },
  ],
}
