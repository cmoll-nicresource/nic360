import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { CHANNEL_OPTIONS } from '@/config/channels'
import { anyoneCanReadPublished, canReadLivestream, staffCanManageEvents } from '@/access/eventAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

type DayRow = { date: string; name?: string | null }

/** Regenerates `days` to match the start/end range, keeping any names already typed for matching dates. */
const fillEventDays: CollectionBeforeChangeHook = ({ data }) => {
  if (!data?.startsAt || !data?.endDate) return data
  const start = new Date(data.startsAt)
  const end = new Date(data.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return data

  const existing: DayRow[] = Array.isArray(data.days) ? data.days : []
  const namesByDate = new Map(existing.map((d) => [new Date(d.date).toDateString(), d.name]))

  const days: DayRow[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cursor <= last) {
    days.push({ date: cursor.toISOString(), name: namesByDate.get(cursor.toDateString()) || '' })
    cursor.setDate(cursor.getDate() + 1)
  }
  data.days = days
  return data
}

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    group: ADMIN_GROUPS.events,
    useAsTitle: 'name',
    defaultColumns: ['name', 'channel', 'startsAt', 'endDate'],
    components: {
      edit: {
        beforeDocumentControls: ['./components/admin/ManageEventLink#ManageEventLink'],
      },
    },
  },
  versions: { drafts: true },
  access: {
    read: anyoneCanReadPublished,
    create: staffCanManageEvents,
    update: staffCanManageEvents,
    delete: staffCanManageEvents,
  },
  hooks: {
    beforeChange: [fillEventDays],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { placeholder: 'GTNF 2026' } },
        { name: 'channel', type: 'select', required: true, options: CHANNEL_OPTIONS },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startsAt', label: 'Start date + time', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'endDate', label: 'End date', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
        {
          name: 'timezone',
          label: 'Event timezone',
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
            'Africa/Nairobi',
            'Asia/Dubai',
            'Asia/Kolkata',
            'Asia/Shanghai',
            'Asia/Tokyo',
            'Australia/Sydney',
          ],
        },
      ],
    },
    { name: 'hasReplay', label: 'Replay', type: 'checkbox' },
    { name: 'hasLivestream', label: 'Livestream', type: 'checkbox' },
    {
      name: 'livestreamUrl',
      label: 'Livestream URL',
      type: 'text',
      admin: {
        description:
          "The event's one Vimeo livestream embed — update it as needed on each day of the event. Readable only by attendees registered for the event, once Livestream is on.",
      },
      access: {
        read: canReadLivestream,
      },
    },
    { name: 'tagline', type: 'text' },
    { name: 'image', label: 'Event image', type: 'upload', relationTo: 'media' },
    { name: 'description', type: 'richText' },
    {
      name: 'venue',
      type: 'group',
      fields: [
        { name: 'address', label: 'Location', type: 'text' },
        { name: 'description', label: 'Location description', type: 'richText' },
      ],
    },
    {
      name: 'accommodation',
      type: 'group',
      fields: [
        { name: 'phone', label: 'Hotel contact number', type: 'text' },
        { name: 'email', label: 'Hotel email', type: 'email' },
        { name: 'bookingUrl', label: 'Booking affiliate link', type: 'text' },
        { name: 'description', label: 'Accommodation description', type: 'richText' },
      ],
    },
    {
      name: 'days',
      label: 'Event days',
      type: 'array',
      admin: {
        description: 'Regenerated from the start/end dates on save; typed names are kept.',
      },
      fields: [
        { name: 'date', type: 'date', required: true, admin: { readOnly: true } },
        { name: 'name', type: 'text', admin: { placeholder: 'Registration Day' } },
      ],
    },
    {
      name: 'ticketTypes',
      label: 'Ticket types',
      type: 'array',
      labels: { singular: 'Ticket type', plural: 'Ticket types' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, admin: { placeholder: 'General Admission' } },
            {
              name: 'honorSystem',
              label: 'Legacy eligibility flag',
              type: 'checkbox',
              admin: { hidden: true, description: 'Deprecated compatibility field; ignored by ticketing.' },
              access: { read: () => false, create: () => false, update: () => false },
            },
            { name: 'onSale', type: 'checkbox', admin: { hidden: true, description: 'Deprecated compatibility field; tickets are always available.' }, access: { read: () => false, create: () => false, update: () => false } },
            { name: 'capacity', type: 'number' },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'inPerson',
              type: 'group',
              admin: { description: 'Leave both blank for no in-person option (e.g. InFocus).' },
              fields: [
                { name: 'price', label: 'Non-subscriber price', type: 'number', min: 0 },
                { name: 'subscriberPrice', label: 'Subscriber price', type: 'number', min: 0, admin: { description: 'Blank = same as non-subscriber price.' } },
              ],
            },
            {
              name: 'virtual',
              type: 'group',
              fields: [
                { name: 'price', label: 'Non-subscriber price', type: 'number', min: 0 },
                { name: 'subscriberPrice', label: 'Subscriber price', type: 'number', min: 0, admin: { description: 'Blank = same as non-subscriber price.' } },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'sponsors',
      type: 'relationship',
      relationTo: 'sponsors',
      hasMany: true,
    },
    {
      name: 'speakers',
      type: 'relationship',
      relationTo: 'speakers',
      hasMany: true,
      admin: { description: "This event's speaker roster. Sessions pick moderators/speakers independently." },
    },
    {
      name: 'sessions',
      type: 'join',
      collection: 'sessions',
      on: 'event',
      admin: { description: 'Build the agenda from here.' },
    },
  ],
}
