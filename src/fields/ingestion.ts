import type { Field } from 'payload'

/**
 * Lets importers (StateNet, the USPTO feed, a future articles crawler)
 * upsert by externalId without creating duplicates. Manual entry just
 * leaves this at its default.
 */
export function ingestionField(): Field {
  return {
    name: 'ingestion',
    type: 'group',
    admin: {
      position: 'sidebar',
    },
    fields: [
      {
        name: 'source',
        type: 'select',
        defaultValue: 'manual',
        options: ['manual', 'statenet', 'uspto'],
      },
      {
        name: 'externalId',
        type: 'text',
      },
      {
        name: 'importedAt',
        type: 'date',
      },
    ],
  }
}
