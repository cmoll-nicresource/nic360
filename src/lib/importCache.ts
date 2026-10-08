/**
 * In-memory holding area for an uploaded spreadsheet between the preview and
 * confirm steps of a dataset import, so the browser doesn't have to re-upload
 * the file. Fine for a single-instance prototype; a multi-instance deployment
 * would need this in Redis/the database instead.
 */
type CacheEntry = {
  buffer: Buffer
  filename: string
  createdAt: number
}

const TTL_MS = 30 * 60 * 1000
const cache = new Map<string, CacheEntry>()

function sweep() {
  const cutoff = Date.now() - TTL_MS
  for (const [token, entry] of cache) {
    if (entry.createdAt < cutoff) cache.delete(token)
  }
}

export function putUpload(buffer: Buffer, filename: string): string {
  sweep()
  const token = crypto.randomUUID()
  cache.set(token, { buffer, filename, createdAt: Date.now() })
  return token
}

export function getUpload(token: string): CacheEntry | undefined {
  return cache.get(token)
}

export function dropUpload(token: string): void {
  cache.delete(token)
}
