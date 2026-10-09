import type { CollectionConfig } from 'payload'

import { anyoneCanRead, canReadReplay, staffCanManageEvents } from '@/access/eventAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const Sessions: CollectionConfig = {
  slug: 'sessions',
  labels: { singular: 'Session', plural: 'Sessions' },
  admin: {
    group: ADMIN_GROUPS.events,
    useAsTitle: 'title',
    defaultColumns: ['title', 'event', 'day', 'type'],
    description: 'Agenda items for all events.',
  },
  versions: { drafts: true },
  access: {
    read: anyoneCanRead,
    create: staffCanManageEvents,
    update: staffCanManageEvents,
    delete: staffCanManageEvents,
  },
  fields: [
    { name: 'event', type: 'relationship', relationTo: 'events', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    {
      name: 'day',
      type: 'date',
      required: true,
      admin: { description: "Pick one of the event's days.", date: { pickerAppearance: 'dayOnly' } },
    },
    {
      type: 'row',
      fields: [
        { name: 'startTime', type: 'date', admin: { date: { pickerAppearance: 'timeOnly' } } },
        { name: 'endTime', type: 'date', admin: { date: { pickerAppearance: 'timeOnly' } } },
        {
          name: 'type',
          label: 'Session type',
          type: 'select',
          required: true,
          options: ['Keynote', 'Panel', 'Break', 'Other'],
        },
        { name: 'room', label: 'Location', type: 'text', admin: { placeholder: 'Main Hall' } },
      ],
    },
    { name: 'moderators', type: 'relationship', relationTo: 'speakers', hasMany: true },
    { name: 'speakers', type: 'relationship', relationTo: 'speakers', hasMany: true },
    {
      name: 'speakerGroups',
      label: 'Custom speaker groups',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true, admin: { placeholder: 'Respondents' } },
        { name: 'speakers', type: 'relationship', relationTo: 'speakers', hasMany: true },
      ],
    },
    {
      name: 'sponsors',
      type: 'relationship',
      relationTo: 'sponsors',
      hasMany: true,
      admin: { description: "Choices should be limited to the event's own sponsors." },
    },
    {
      name: 'replayEmbed',
      label: 'Replay embed',
      type: 'textarea',
      admin: {
        description: "Readable only by attendees registered for the event, once the event's Replay flag is on.",
      },
      access: {
        read: canReadReplay,
      },
    },
  ],
}
