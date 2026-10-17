/** Server-managed embed destination. Never accept a URL supplied by a visitor. */
export function stateNetITracUrl(value = process.env.STATENET_ITRAC_URL): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}
