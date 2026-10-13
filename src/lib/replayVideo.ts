export type VideoSource = { kind: 'direct'; url: string } | { kind: 'vimeo'; id: string } | null

// Order matters: the player.vimeo.com embed-URL form must be checked before
// the general vimeo.com form, since player.vimeo.com also contains "vimeo.com".
const VIMEO_PATTERNS = [/player\.vimeo\.com\/video\/(\d+)/i, /vimeo\.com\/(?:video\/)?(\d+)/i]

/** Classifies a Session.replayVideoUrl so the player knows whether to render a native <video> or a tracked Vimeo embed. */
export function detectVideoSource(url: string | null | undefined): VideoSource {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  for (const pattern of VIMEO_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) return { kind: 'vimeo', id: match[1] }
  }

  return { kind: 'direct', url: trimmed }
}
