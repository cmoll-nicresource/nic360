import type { Field } from 'payload'

/**
 * Index terms shared by Article and Bill (Trademarks stay unindexed).
 * A location rule matches the place and everything inside it, so Locations
 * carries a parent hierarchy; see the Locations collection.
 */
export function indexTermFields(): Field[] {
  return [
    {
      name: 'locations',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      required: true,
    },
    {
      name: 'sectors',
      type: 'relationship',
      relationTo: 'sectors',
      hasMany: true,
      required: true,
    },
    {
      name: 'products',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      required: true,
    },
    {
      name: 'primarySubject',
      label: 'Primary subject',
      type: 'relationship',
      relationTo: 'subjects',
      required: true,
    },
    {
      name: 'subjects',
      type: 'relationship',
      relationTo: 'subjects',
      hasMany: true,
      required: true,
    },
  ]
}
