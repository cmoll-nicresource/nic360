import type { CollectionConfig } from 'payload'

import { staffCanManageRegistrations } from '@/access/eventAccess'
import { ADMIN_GROUPS } from '@/config/adminGroups'

export const LivestreamPings: CollectionConfig = {
  slug: 'livestream-pings',
  labels: { singular: 'Livestream Ping', plural: 'Livestream Pings' },
  admin: {
    group: ADMIN_GROUPS.events,
    useAsTitle: 'id',
    defaultColumns: ['event', 'user', 'createdAt'],
    description:
      "One row per attendee per ping while their livestream page tab is open — see src/components/LivestreamPresence.tsx. A presence log, not duration: the attendee report matches each attendee's ping timestamps against the session schedule to estimate which panels they were likely watching.",
  },
  access: {
    read: staffCanManageRegistrations,
    create: () => false,
    update: () => false,
    delete: staffCanManageRegistrations,
  },
  fields: [
    { name: 'event', type: 'relationship', relationTo: 'events', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
  ],
}
