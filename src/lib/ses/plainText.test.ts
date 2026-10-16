import { expect, it } from 'vitest'
import { newsletterPlainText } from './plainText'
it('preserves newsletter text and actionable links while dropping styling', () => {
  expect(
    newsletterPlainText(
      '<html><head><title>Hidden</title><style>body{}</style></head><body><h1>News &amp; analysis</h1><p>A&#39;s &#x2014; B</p><p><a href="https://example.invalid/story?x=1&amp;y=2">Read story</a></p></body></html>',
    ),
  ).toBe("News & analysis\nA's — B\nRead story (https://example.invalid/story?x=1&y=2)")
})
