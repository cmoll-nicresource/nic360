import type { Field, Where } from 'payload'

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
      admin: {
        description:
          'Only top-level (ALL CAPS) subjects can be primary. Add more specific terms under Subjects.',
      },
      // Top-level subjects only. A value already saved on the document is kept
      // selectable so legacy records with a non-top-level primary still save.
      filterOptions: ({ siblingData }): Where => {
        const current = (siblingData as { primarySubject?: unknown } | undefined)?.primarySubject
        const currentId =
          current && typeof current === 'object' && 'id' in current
            ? (current as { id: number | string }).id
            : current
        const topLevel: Where = { parent: { exists: false } }
        return typeof currentId === 'number' || typeof currentId === 'string'
          ? { or: [topLevel, { id: { equals: currentId } }] }
          : topLevel
      },
    },
    {
      name: 'subjects',
      type: 'relationship',
      relationTo: 'subjects',
      hasMany: true,
    },
  ]
}
