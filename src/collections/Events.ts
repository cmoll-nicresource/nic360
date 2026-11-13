import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import { CHANNEL_OPTIONS } from '@/config/channels'
import { anyoneCanReadPublished, canReadLivestream, staffCanManageEvents } from '@/access/eventAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'
import { slugifyEventName } from '@/lib/eventLinks'

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

/**
 * Keeps every event addressable at /events/<slug>. A typed address is tidied
 * into slug form; an empty one is built from the name, with a number added if
 * another event already has it. An existing address is never changed for staff.
 */
const ensureSlug: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  if (typeof data.slug === 'string' && data.slug.trim()) {
    data.slug = slugifyEventName(data.slug)
    return data
  }
  // A partial update that doesn't mention the address leaves it alone.
  if (data.slug === undefined && originalDoc?.slug) return data
  const name = data.name ?? originalDoc?.name
  if (typeof name !== 'string' || !name.trim()) return data
  const base = slugifyEventName(name)
  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`
    const { totalDocs } = await req.payload.count({
      collection: 'events',
      where: {
        and: [
          { slug: { equals: candidate } },
          ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
        ],
      },
      overrideAccess: true,
      req,
    })
    if (!totalDocs) {
      data.slug = candidate
      break
    }
  }
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
    beforeValidate: [ensureSlug],
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
    {
      name: 'slug',
      label: 'Page address',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'The end of the event page link, e.g. gtnf-2027 for /events/gtnf-2027. Leave empty to build it from the name. Changing it later breaks links people have already shared.',
      },
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
      name: 'updatesUrl',
      label: 'Receive-updates link',
      type: 'text',
      admin: {
        description:
          'Optional sign-up form for people who want news about this event. Shown as "Receive updates" on the event and channel pages.',
      },
    },
    {
      name: 'agendaMode',
      label: 'Agenda shown on the event page',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft agenda (the text below)', value: 'draft' },
        { label: 'Full agenda (sessions with times and speakers)', value: 'sessions' },
      ],
      admin: {
        description:
          'Use the draft while the programme is still placeholders. Switch to the full agenda once sessions have times and speakers; the draft text is kept but no longer shown.',
      },
    },
    {
      name: 'draftAgenda',
      label: 'Draft agenda',
      type: 'richText',
      admin: {
        description:
          'Paste straight from Word: headings, bold text and lists are kept. Shown publicly with a "Draft programme, subject to change" label.',
      },
    },
    {
      type: 'collapsible',
      label: 'Who attends',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'audience',
          label: false,
          type: 'group',
          fields: [
            {
              name: 'stats',
              label: 'Headline figures',
              type: 'array',
              labels: { singular: 'Figure', plural: 'Figures' },
              admin: {
                description:
                  'Three or four numbers from the last event, shown large on the event and forum pages. For example "400+" and "delegates", or "38" and "countries".',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'value', type: 'text', required: true, admin: { placeholder: '400+' } },
                    { name: 'label', type: 'text', required: true, admin: { placeholder: 'delegates' } },
                  ],
                },
              ],
            },
            {
              name: 'intro',
              label: 'Who you will meet',
              type: 'richText',
              admin: {
                description:
                  'The kinds of organisations and roles in the room: manufacturers, regulators, researchers, suppliers, investors and so on.',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Key dates',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'keyDates',
          label: 'Key dates',
          type: 'array',
          labels: { singular: 'Date', plural: 'Dates' },
          admin: {
            description:
              'Deadlines shown beside the ticket prices, such as "Early-bird rate ends" or "Hotel room block closes". These are notices only: they do not change prices or close registration.',
          },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'label', type: 'text', required: true, admin: { placeholder: 'Early-bird rate ends' } },
                { name: 'date', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Practical information (FAQ)',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'faq',
          label: 'Questions and answers',
          type: 'array',
          labels: { singular: 'Question', plural: 'Questions' },
          admin: {
            description:
              'Shown as a list visitors can open. Typical topics: dress code, visa invitation letters, refunds and substitutions, accessibility, code of conduct, and whether sessions are recorded or on the record.',
          },
          fields: [
            { name: 'question', type: 'text', required: true },
            { name: 'answer', type: 'richText', required: true },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Highlights (after the event)',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'highlights',
          label: false,
          type: 'group',
          admin: {
            description:
              "Shown on this event's page once it has taken place, on the forum home page, and on the next event's page as a look back.",
          },
          fields: [
            {
              name: 'videoUrl',
              label: 'Highlights video',
              type: 'text',
              admin: { description: 'A public Vimeo or YouTube link.' },
            },
            {
              name: 'photos',
              type: 'upload',
              relationTo: 'media',
              hasMany: true,
              admin: { description: 'Up to eight are shown. Give each a short description for screen readers.' },
            },
            {
              name: 'testimonials',
              label: 'Delegate quotes',
              type: 'array',
              labels: { singular: 'Quote', plural: 'Quotes' },
              fields: [
                { name: 'quote', type: 'textarea', required: true },
                {
                  type: 'row',
                  fields: [
                    { name: 'name', type: 'text', admin: { description: 'Leave empty for an unattributed quote.' } },
                    { name: 'organisation', label: 'Role or organisation', type: 'text' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'venue',
      type: 'group',
      fields: [
        { name: 'address', label: 'Location', type: 'text' },
        { name: 'description', label: 'Location description', type: 'richText' },
        {
          name: 'transportation',
          label: 'Getting there',
          type: 'richText',
          admin: { description: 'Airports, trains, parking, shuttles and local transport.' },
        },
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
      name: 'sponsorship',
      label: 'Partner with us',
      type: 'richText',
      admin: {
        description:
          'Sponsorship packages, prices and what each includes. Shown in the "Partner with us" section with the channel contact address.',
      },
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
