import { describe, expect, it } from 'vitest'

import {
  copyPost,
  decodeHtmlEntities,
  parseSources,
  plainText,
  postRefFromUrl,
  refreshedHeadline,
  sanitizeStoryHtml,
  stripTracking,
  type WpPost,
} from './tobaccoReporter'

// Shaped like tobaccoreporter.com/wp-json/wp/v2/posts/170519?_embed (November 2026).
const post: WpPost = {
  id: 170519,
  date_gmt: '2026-11-18T16:07:13',
  modified_gmt: '2026-11-18T16:20:00',
  link: 'https://tobaccoreporter.com/2026/11/18/modern-oral-spurs-turning-points-27-rise-in-q3/?utm_source=rss&utm_medium=rss',
  title: { rendered: 'Modern Oral Spurs Turning Point&#8217;s 27% Rise in Q3' },
  content: {
    rendered: `<p class="wp-block-paragraph">Turning Point Brands reported net sales of <strong>$151.1 million</strong>.</p>


<p class="wp-block-paragraph"></p>
<p class="wp-block-paragraph">&nbsp;</p>
<figure class="wp-block-image"><img src="https://tobaccoreporter.com/x.jpg" alt=""></figure>
<p style="color:red" onclick="steal()">See the <a href="https://www.turningpointbrands.com/" target="_blank" rel="noopener" class="x">release</a>.<script>alert(1)</script></p>
<iframe src="https://www.youtube.com/embed/abc"></iframe>
<p>The post <a href="https://tobaccoreporter.com/x/">Modern Oral</a> first appeared on <a href="https://tobaccoreporter.com">Tobacco Reporter</a>.</p>`,
  },
  meta: { n360_sources: 'Turning Point Brands | https://www.turningpointbrands.com/investors\nReuters|https://www.reuters.com/x' },
  _embedded: {
    author: [{ name: 'Mike Macdonald' }],
    'wp:featuredmedia': [{ source_url: 'https://tobaccoreporter.com/wp-content/uploads/2026/11/tpb.jpg', alt_text: 'Stoker&#8217;s tins', mime_type: 'image/jpeg' }],
  },
}

describe('copying a Tobacco Reporter post', () => {
  it('keeps the headline, text, sources, dates, author and featured image', () => {
    const copied = copyPost(post)
    expect(copied).toMatchObject({
      postId: 170519,
      url: 'https://tobaccoreporter.com/2026/11/18/modern-oral-spurs-turning-points-27-rise-in-q3/',
      headline: 'Modern Oral Spurs Turning Point’s 27% Rise in Q3',
      publishedAt: '2026-11-18T16:07:13.000Z',
      modifiedAt: '2026-11-18T16:20:00.000Z',
      author: 'Mike Macdonald',
      image: { url: 'https://tobaccoreporter.com/wp-content/uploads/2026/11/tpb.jpg', alt: 'Stoker’s tins' },
      sources: [
        { name: 'Turning Point Brands', url: 'https://www.turningpointbrands.com/investors' },
        { name: 'Reuters', url: 'https://www.reuters.com/x' },
      ],
    })
  })

  it('strips WordPress markup, scripts, embeds, empty blocks and the feed footer', () => {
    expect(copyPost(post).bodyHtml).toBe(
      '<p>Turning Point Brands reported net sales of <strong>$151.1 million</strong>.</p>\n<p>See the <a href="https://www.turningpointbrands.com/">release</a>.</p>',
    )
  })

  it('copies a post with no image, sources or author', () => {
    const bare = copyPost({ id: 1, link: 'https://tobaccoreporter.com/a/', title: { rendered: 'A' } })
    expect(bare).toMatchObject({ image: null, sources: [], author: null, bodyHtml: '', publishedAt: null })
    expect(copyPost({ ...post, _embedded: { 'wp:featuredmedia': [{ source_url: 'https://x/clip.mp4', mime_type: 'video/mp4' }] } }).image).toBeNull()
  })
})

describe('sanitizing story text', () => {
  it('rejects script URLs and unknown tags but keeps structure', () => {
    expect(sanitizeStoryHtml('<h1>Head</h1><ul><li><a href="javascript:alert(1)">x</a></li></ul><table><tr><td>cell</td></tr></table>')).toBe(
      '<h2>Head</h2><ul><li><a>x</a></li></ul>cell',
    )
    expect(sanitizeStoryHtml('<p>a<br>b</p><b>bold</b><i>it</i>')).toBe('<p>a<br />b</p><strong>bold</strong><em>it</em>')
  })
})

describe('the Nicotine360 sources box', () => {
  it('reads "name | link" lines, bare links and names without links', () => {
    expect(parseSources('Source: EU Council | https://consilium.europa.eu/x\n\n https://www.cyprus-mail.com/2026/11/09/y \nAntara News Agency\n- Law 360 (pay) | https://www.law360.com/z')).toEqual([
      { name: 'EU Council', url: 'https://consilium.europa.eu/x' },
      { name: 'cyprus-mail.com', url: 'https://www.cyprus-mail.com/2026/11/09/y' },
      { name: 'Antara News Agency', url: null },
      { name: 'Law 360 (pay)', url: 'https://www.law360.com/z' },
    ])
  })

  it('drops links that are not http(s) and ignores non-text values', () => {
    expect(parseSources('Bad | javascript:alert(1)')).toEqual([{ name: 'Bad', url: null }])
    expect(parseSources(undefined)).toEqual([])
    expect(parseSources(42)).toEqual([])
  })
})

describe('pasted links', () => {
  const site = 'https://tobaccoreporter.com'
  it('finds the slug or post id', () => {
    expect(postRefFromUrl('https://www.tobaccoreporter.com/2026/11/18/eu-tobacco-tax-deal/?utm_source=rss', site)).toEqual({ slug: 'eu-tobacco-tax-deal' })
    expect(postRefFromUrl('https://tobaccoreporter.com/?p=170519', site)).toEqual({ id: 170519 })
  })
  it('rejects other sites and non-article pages', () => {
    expect(postRefFromUrl('https://example.com/2026/11/18/eu-tobacco-tax-deal/', site)).toBeNull()
    expect(postRefFromUrl('https://tobaccoreporter.com/category/top-news/', site)).toBeNull()
    expect(postRefFromUrl('https://tobaccoreporter.com/2026/11/', site)).toBeNull()
    expect(postRefFromUrl('not a link', site)).toBeNull()
  })
})

describe('text helpers', () => {
  it('decodes WordPress entities', () => {
    expect(decodeHtmlEntities('KT&#038;G &amp; Co&#x2019;s &hellip; &bogus;')).toBe('KT&G & Co’s … &bogus;')
    expect(plainText('<p>The Commission&#8217;s draft\n impact</p>')).toBe('The Commission’s draft impact')
  })
  it('removes only utm parameters', () => {
    expect(stripTracking('https://tobaccoreporter.com/a/?utm_source=rss&p=2')).toBe('https://tobaccoreporter.com/a/?p=2')
  })
  it('keeps an editor headline on refresh but follows an unchanged one', () => {
    expect(refreshedHeadline({ headline: 'Haypp Launches UK Pouch Advent Calendar', trHeadline: 'Haypp Launches Nicotine Pouch Advent Calendar' }, 'Haypp Launches Advent Calendar')).toBe('Haypp Launches UK Pouch Advent Calendar')
    expect(refreshedHeadline({ headline: 'Old', trHeadline: 'Old' }, 'New')).toBe('New')
    expect(refreshedHeadline({ headline: '', trHeadline: null }, 'New')).toBe('New')
  })
})
