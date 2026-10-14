import type { Payload } from 'payload'

import { withTransaction } from './db'
import { loadMonthlyFile, type LoadResult } from './monthly'

class PreviewRollback extends Error {}

export interface PreviewResult {
  fileName: string
  result: LoadResult | null
  error: string | null
  /** True when this month already has rows loaded — confirming replaces them. */
  wouldReplace: boolean
}

/**
 * Runs the real loadMonthlyFile logic (same validation, same "does this
 * month already exist" check, same YTD check) inside a transaction that is
 * always rolled back — so the editor sees exactly what confirming would do,
 * without anything actually being written.
 */
export async function previewMonthlyFile(payload: Payload, fileName: string, buffer: Buffer, year?: number): Promise<PreviewResult> {
  let result: LoadResult | null = null
  let wouldReplace = false
  try {
    await withTransaction(payload, async (c) => {
      result = await loadMonthlyFile(c, fileName, buffer, {
        year,
        confirmReplace: async (_flow, _yr, _mo, existing) => {
          wouldReplace = existing > 0
          return true
        },
      })
      throw new PreviewRollback('preview: rolling back, nothing is written')
    })
  } catch (err) {
    if (err instanceof PreviewRollback) return { fileName, result, error: null, wouldReplace }
    return { fileName, result: null, error: err instanceof Error ? err.message : String(err), wouldReplace: false }
  }
  // Unreachable: the transaction always throws PreviewRollback above.
  return { fileName, result, error: null, wouldReplace }
}
