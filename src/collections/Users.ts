import type { CollectionConfig } from 'payload'

import { assignAccessProviderOnVerify } from '@/hooks/assignAccessProviderOnVerify'
import { staffHasMinRole, staffHasRole } from '@/access/staffRoles'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'User',
    plural: 'Users',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'accessProvider', 'status'],
    description: 'Readers: members using a company subscription, or event attendees.',
  },
  auth: {
    verify: true,
  },
  access: {
    read: ({ req }) => {
      if (staffHasRole(req.user, 'editor')) return true
      if (req.user?.collection === 'users') return { id: { equals: req.user.id } }
      return false
    },
    create: () => true, // self sign-up; staff can also create users by hand
    update: ({ req, id }) => {
      if (staffHasRole(req.user, 'gatekeeper')) return true
      return req.user?.collection === 'users' && req.user.id === id
    },
    delete: staffHasMinRole('gatekeeper'),
  },
  hooks: {
    afterChange: [assignAccessProviderOnVerify],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'firstName', type: 'text', required: true },
        { name: 'lastName', type: 'text', required: true },
      ],
    },
    {
      name: 'salutation',
      type: 'select',
      options: ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Mx.'],
    },
    {
      name: 'department',
      type: 'text',
    },
    {
      name: 'phone',
      label: 'Phone number',
      type: 'text',
    },
    {
      name: 'businessSector',
      label: 'Business sector',
      type: 'select',
      admin: {
        description: 'Sign-up profile field, separate from the Sectors taxonomy used on excerpts.',
      },
      options: [
        { label: 'Manufacturer/Exporter: Tobacco and Vapor Products/Services', value: 'manufacturer-exporter' },
        { label: 'Retail & Distribution', value: 'retail-distribution' },
        { label: 'Public Health', value: 'public-health' },
        { label: 'Academia', value: 'academia' },
        { label: 'Government/Regulatory', value: 'government-regulatory' },
        { label: 'Law/Consulting', value: 'law-consulting' },
        { label: 'Media', value: 'media' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'timezone',
      type: 'select',
      options: [
        'Pacific/Honolulu',
        'America/Anchorage',
        'America/Los_Angeles',
        'America/Denver',
        'America/Chicago',
        'America/New_York',
        'America/Sao_Paulo',
        'Europe/London',
        'Europe/Paris',
        'Europe/Moscow',
        'Africa/Nairobi',
        'Asia/Dubai',
        'Asia/Kolkata',
        'Asia/Shanghai',
        'Asia/Tokyo',
        'Australia/Sydney',
      ],
    },
    {
      name: 'avatar',
      label: 'Profile picture',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      required: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
    },
    {
      name: 'accessProvider',
      label: 'Access provider',
      type: 'relationship',
      relationTo: 'access-providers',
      admin: {
        description:
          'Set automatically when a verified email matches a provider\'s allowed domains. Empty for event-only attendees.',
      },
      access: {
        // Readers can see their own provider but not reassign themselves to another.
        update: staffHasMinRole('gatekeeper'),
      },
    },
  ],
}
