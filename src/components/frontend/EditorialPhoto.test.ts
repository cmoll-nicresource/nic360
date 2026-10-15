import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { eventPhotoKey } from '@/config/editorialPhotos'
import { EditorialPhoto } from './EditorialPhoto'
import { PublicationCover } from './Editorial'

describe('editorial photography', () => {
  it('offers responsive WebPs and decorative alt text without exposing originals', () => {
    const html = renderToStaticMarkup(
      createElement(EditorialPhoto, { photo: 'port', decorative: true }),
    )
    expect(html).toContain('container-port-640.webp 640w')
    expect(html).toContain('container-port-1920.webp 1920w')
    expect(html).toContain('alt=""')
    expect(html).toContain('loading="lazy"')
    expect(html).not.toContain('originals')
  })
  it('does not assign the Lansdowne venue to unrelated or historical events', () => {
    expect(eventPhotoKey({ channel: 'atnf', name: 'ATNF 2027' })).toBe('lansdowne')
    expect(eventPhotoKey({ channel: 'atnf', name: 'ATNF 2026' })).toBeNull()
    expect(eventPhotoKey({ channel: 'gtnf', name: 'GTNF 2027' })).toBeNull()
  })
  it('uses the shipping photo for the Trade Barometer and preserves a usable CMS cover', () => {
    const publication = {
      title: 'Trade Barometer',
      frequency: 'monthly' as const,
      generator: 'monthly-trade-barometer' as const,
      thumbnail: null,
    }
    expect(renderToStaticMarkup(createElement(PublicationCover, { publication }))).toContain(
      'international-shipping-1280.webp',
    )
    expect(
      renderToStaticMarkup(
        createElement(PublicationCover, {
          publication: {
            ...publication,
            thumbnail: {
              id: 1,
              alt: 'Uploaded report cover',
              url: '/cover.png',
              width: 400,
              height: 600,
              createdAt: '',
              updatedAt: '',
            },
          },
        }),
      ),
    ).not.toContain('international-shipping')
  })
})
