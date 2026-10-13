import type { Field } from 'payload'

/**
 * Index terms shared by Article and Bill (Trademarks stay unindexed).
 * A location rule matches the place and everything inside it, so Locations
 * carries a parent hierarchy; see the Locations collection.
 *
 * Not required: migrating the real old site's content showed only ~50% of
 * published Articles/Bills were ever tagged with a Subject/Sector/Product,
 * and almost none had a Location — so a hard requirement would reject
 * roughly half of real content. Staff can still fill gaps in after the fact.
 */
export function indexTermFields(): Field[] {
  return [
    {
      name: 'locations',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
    },
    {
      name: 'sectors',
      type: 'relationship',
      relationTo: 'sectors',
      hasMany: true,
    },
    {
      name: 'products',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
    },
    {
      name: 'primarySubject',
      label: 'Primary subject',
      type: 'relationship',
      relationTo: 'subjects',
    },
    {
      name: 'subjects',
      type: 'relationship',
      relationTo: 'subjects',
      hasMany: true,
    },
  ]
}
