import { describe, expect, it } from 'vitest'

import { detectVideoSource } from './replayVideo'

describe('detectVideoSource', () => {
  it('returns null for empty/missing input', () => {
    expect(detectVideoSource(undefined)).toBeNull()
    expect(detectVideoSource(null)).toBeNull()
    expect(detectVideoSource('')).toBeNull()
    expect(detectVideoSource('   ')).toBeNull()
  })

  it('recognizes plain vimeo.com links', () => {
    expect(detectVideoSource('https://vimeo.com/123456789')).toEqual({ kind: 'vimeo', id: '123456789' })
    expect(detectVideoSource('vimeo.com/123456789')).toEqual({ kind: 'vimeo', id: '123456789' })
  })

  it('recognizes vimeo.com/video/ and player.vimeo.com/video/ links, including query strings', () => {
    expect(detectVideoSource('https://vimeo.com/video/123456789')).toEqual({ kind: 'vimeo', id: '123456789' })
    expect(detectVideoSource('https://player.vimeo.com/video/123456789?h=abc123')).toEqual({
      kind: 'vimeo',
      id: '123456789',
    })
  })

  it('treats anything else as a direct video file URL', () => {
    expect(detectVideoSource('https://bucket.s3.amazonaws.com/replays/session1.mp4')).toEqual({
      kind: 'direct',
      url: 'https://bucket.s3.amazonaws.com/replays/session1.mp4',
    })
    expect(detectVideoSource('https://example.com/video.mp4')).toEqual({
      kind: 'direct',
      url: 'https://example.com/video.mp4',
    })
  })

  it('trims whitespace', () => {
    expect(detectVideoSource('  https://vimeo.com/123456789  ')).toEqual({ kind: 'vimeo', id: '123456789' })
  })
})
