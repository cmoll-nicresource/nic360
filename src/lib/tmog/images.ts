import type { Payload } from 'payload'

const MAX_RETRIES = 3

function imageUrl(serial: string, issueDate: string): string {
  return `https://cdn.uspto.gov/img/${serial}/${issueDate}/original`
}

/** A simple rate limiter: each call to `wait()` resolves no sooner than `minIntervalMs` after the previous one. */
export function createThrottle(minIntervalMs: number) {
  let lastAt = 0
  return async function wait() {
    const now = Date.now()
    const delay = lastAt + minIntervalMs - now
    lastAt = Math.max(now, lastAt + minIntervalMs)
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

export type ImageFetchOutcome = { mediaId: number } | { missing: true } | { error: string }

/**
 * Downloads one mark's image from the USPTO CDN and stores it as Media.
 * Retries transient failures up to `MAX_RETRIES` times; a 404 (no image for
 * this mark) is reported as `missing`, not an error — the caller should
 * leave the trademark's image blank and keep going, never fail the run.
 */
export async function fetchAndStoreTrademarkImage(
  payload: Payload,
  params: { serial: string; issueDate: string; markText: string },
  throttle: () => Promise<void>,
): Promise<ImageFetchOutcome> {
  const url = imageUrl(params.serial, params.issueDate)
  let lastError = 'unknown error'

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await throttle()

    let res: Response
    try {
      res = await fetch(url)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      continue
    }

    if (res.status === 404) return { missing: true }

    if (!res.ok) {
      lastError = `HTTP ${res.status}`
      continue
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${params.markText} — USPTO trademark image (serial ${params.serial})` },
      file: {
        data: buffer,
        mimetype: res.headers.get('content-type') || 'image/png',
        name: `${params.serial}.png`,
        size: buffer.length,
      },
      overrideAccess: true,
    })
    return { mediaId: media.id }
  }

  return { error: lastError }
}
