export const PAGE_SIZE = 25

/** Parses a 1-based page number from a query param, clamped to >= 1. */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}
