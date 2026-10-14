/**
 * Migrated subject/sector names came in mixed case ("SOCIETY & POLITICS" next
 * to "Market trends"). Rather than re-casing the underlying data, display
 * reads it sentence case everywhere a taxonomy term shows up as a pill or
 * tag. Leaves words that are already mixed-case (acronyms like "USPTO",
 * "FDA") alone — only touches strings that are ALL CAPS or all lowercase.
 */
export function sentenceCase(value: string): string {
  if (!value) return value
  const hasLower = /[a-z]/.test(value)
  const hasUpper = /[A-Z]/.test(value)
  // Already mixed case (e.g. "USPTO filings", "FDA") — leave it alone.
  if (hasLower && hasUpper) return value

  const lower = value.toLowerCase()
  return lower.replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase())
}
