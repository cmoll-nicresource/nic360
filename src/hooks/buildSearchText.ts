import type { CollectionBeforeChangeHook } from 'payload'

import { lexicalToPlainText } from '@/lib/lexical'

/**
 * Populates the hidden `searchText` field from the given source fields —
 * richText fields are stripped to plain text, plain-text fields used as-is —
 * so Postgres full-text search (src/lib/fullTextSearch.ts) has something
 * simple to query instead of parsing Lexical JSON in SQL.
 */
export function buildSearchTextHook(fieldNames: string[]): CollectionBeforeChangeHook {
  return ({ data }) => {
    if (!data) return data
    const parts = fieldNames.map((name) => {
      const value = data[name]
      if (value == null) return ''
      if (typeof value === 'string') return value
      return lexicalToPlainText(value)
    })
    // The field has a 40,000-char max length; a handful of migrated Bills'
    // full legislative text runs well past that.
    data.searchText = parts.filter(Boolean).join(' ').slice(0, 40000)
    return data
  }
}
