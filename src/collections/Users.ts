import type { CollectionConfig } from 'payload'

import { assignAccessProviderOnVerify } from '@/hooks/assignAccessProviderOnVerify'
import { syncMailchimpOnUserChange } from '@/hooks/syncMailchimpOnUserChange'
import { staffHasMinRole, staffHasRole } from '@/access/staffRoles'
import { SITE_URL } from '@/lib/env'

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
    forgotPassword: {
      // Payload's default reset-password link always points at /admin/reset,
      // which only works for the admin.user collection (staff). Readers get
      // their own front-end page instead.
      generateEmailHTML: ({ token } = {}) =>
        `<p>You are receiving this because you (or someone else) requested a password reset.</p>
<p><a href="${SITE_URL}/reset-password/${token}">${SITE_URL}/reset-password/${token}</a></p>
<p>If you did not request this, you can ignore this email.</p>`,
    },
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
    afterChange: [assignAccessProviderOnVerify, syncMailchimpOnUserChange],
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
    {
      name: 'emailPublications',
      label: 'Publication email preferences',
      type: 'relationship',
      relationTo: 'publications',
      hasMany: true,
      admin: {
        description:
          'Checkboxes on the account page. Only shown to readers with an active Base or Premium plan.',
      },
    },
    {
      name: 'registrations',
      label: 'Products purchased',
      type: 'join',
      collection: 'event-registrations',
      on: 'attendee',
      admin: {
        description: 'Event registrations where this user is the attendee. Old product orders are not migrated.',
      },
    },
  ],
}
