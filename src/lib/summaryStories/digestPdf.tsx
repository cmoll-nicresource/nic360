/**
 * The weekly Executive Summary PDF: a linked contents page with page numbers,
 * the issue's advertiser after the contents, then each weekly heading with
 * its stories and their sources. Laid out with @react-pdf/renderer like the
 * other generated reports. See docs/executive-summary-stories.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'

import { htmlToPdfBlocks, type PdfRun } from './digest'

export type DigestStory = {
  id: number
  headline: string
  bodyHtml: string
  sources: { name: string; url: string | null }[]
  url: string | null
}
export type DigestInput = {
  title: string
  dateLabel: string
  groups: { heading: { id: number; title: string }; stories: DigestStory[] }[]
  ad: { png: Buffer; width: number; height: number; href: string } | null
}

const FONT = 'SummaryNoto'
const fontFile = (name: string) => path.join(process.cwd(), 'public/fonts', name)
Font.register({
  family: FONT,
  fonts: [
    { src: fontFile('NotoSans-Regular.ttf') },
    { src: fontFile('NotoSans-Bold.ttf'), fontWeight: 700 },
    { src: fontFile('NotoSans-Italic.ttf'), fontStyle: 'italic' },
    { src: fontFile('NotoSans-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ],
})
// Words are never split with hyphens; long URLs still wrap at their characters.
Font.registerHyphenationCallback((word) => [word])

const NAVY = '#1c4066'
const BLUE = '#285888'
const MUTED = '#607286'
const INK = '#203245'
const PAGE = { width: 612, side: 54 }
const CONTENT_WIDTH = PAGE.width - PAGE.side * 2

const s = StyleSheet.create({
  page: { paddingTop: 82, paddingBottom: 60, paddingHorizontal: PAGE.side, fontFamily: FONT, fontSize: 10, lineHeight: 1.5, color: INK },
  logo: { position: 'absolute', top: 26, left: PAGE.side, width: 150, height: (150 * 424) / 2182 },
  running: { position: 'absolute', top: 32, right: PAGE.side, width: 300, textAlign: 'right', fontSize: 8, color: MUTED },
  footer: { position: 'absolute', top: 752, left: PAGE.side, width: 360, fontSize: 7.5, color: MUTED },
  pageNumber: { position: 'absolute', top: 752, right: PAGE.side, width: 120, textAlign: 'right', fontSize: 7.5, color: MUTED },
  title: { fontSize: 26, lineHeight: 1.25, fontWeight: 700, color: NAVY },
  date: { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 18 },
  contents: { fontSize: 15, fontWeight: 700, color: NAVY, paddingBottom: 5, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#cad7e4' },
  tocRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tocHeading: { fontWeight: 700, fontSize: 10, marginTop: 7, marginBottom: 2, color: NAVY },
  tocStory: { fontSize: 9, lineHeight: 1.35, marginBottom: 2, paddingLeft: 12 },
  tocText: { flexGrow: 1, flexShrink: 1, paddingRight: 10 },
  tocPage: { width: 28, textAlign: 'right' },
  adLabel: { fontSize: 7, color: MUTED, textAlign: 'center', marginBottom: 4 },
  section: { backgroundColor: NAVY, color: '#ffffff', fontSize: 15, fontWeight: 700, paddingVertical: 7, paddingHorizontal: 10, marginTop: 6, marginBottom: 12 },
  headline: { fontSize: 13, lineHeight: 1.3, fontWeight: 700, color: NAVY, marginBottom: 6 },
  paragraph: { marginBottom: 7 },
  subheading: { fontWeight: 700, marginTop: 4, marginBottom: 5 },
  quote: { marginBottom: 7, marginLeft: 12, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#cad7e4', color: MUTED },
  item: { flexDirection: 'row', marginBottom: 4 },
  source: { fontSize: 9, marginBottom: 1 },
  storyEnd: { fontSize: 7.5, color: MUTED, marginTop: 5, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#dce4eb' },
  link: { color: BLUE, textDecoration: 'none' },
})

function runs(items: PdfRun[]) {
  return items.map((run, i) => {
    const style = {
      fontWeight: run.bold ? 700 : 400,
      fontStyle: run.italic ? ('italic' as const) : ('normal' as const),
      textDecoration: run.underline || run.href ? ('underline' as const) : ('none' as const),
      ...(run.href ? { color: BLUE } : {}),
    }
    return run.href ? (
      <Link key={i} src={run.href} style={style}>
        {run.text}
      </Link>
    ) : (
      <Text key={i} style={style}>
        {run.text}
      </Text>
    )
  })
}

function StoryBody({ html }: { html: string }) {
  return (
    <>
      {htmlToPdfBlocks(html).map((block, i) => {
        if (block.kind === 'item')
          return (
            <View key={i} style={[s.item, { paddingLeft: 10 + block.depth * 12 }]} wrap={false}>
              <Text style={{ width: 14 }}>{block.marker}</Text>
              <Text style={{ flex: 1 }}>{runs(block.runs)}</Text>
            </View>
          )
        return (
          <Text key={i} style={block.kind === 'heading' ? s.subheading : block.kind === 'quote' ? s.quote : s.paragraph} orphans={2} widows={2}>
            {runs(block.runs)}
          </Text>
        )
      })}
    </>
  )
}

/** Destination ids, shared with the page-number pass. */
export const digestAnchor = {
  heading: (id: number) => `heading-${id}`,
  story: (id: number) => `story-${id}`,
}

export function digestDocument(input: DigestInput, pages: Map<string, number> = new Map()) {
  const logo = { data: fs.readFileSync(path.join(process.cwd(), 'public/logo.png')), format: 'png' as const }
  const page = (anchor: string) => (pages.has(anchor) ? String(pages.get(anchor)) : '')
  const chrome = ({ children, pageNumber, totalPages }: { children?: React.ReactNode; pageNumber?: number; totalPages?: number }) => (
    <>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF primitive */}
      <Image src={logo} style={s.logo} />
      <Text style={s.running}>
        {input.title} | {input.dateLabel}
      </Text>
      <Text style={s.footer}>NICOTINE360 · Nicotine Resource Consortium</Text>
      <Text style={s.pageNumber}>
        Page {pageNumber} of {totalPages}
      </Text>
      {children}
    </>
  )
  const adHeight = input.ad ? Math.min((CONTENT_WIDTH * input.ad.height) / input.ad.width, 420) : 0
  return (
    <Document title={`${input.title} - ${input.dateLabel}`} author="Nicotine360" subject="Executive Summary">
      <Page size="LETTER" style={s.page} layout={chrome}>
        <View wrap={false}>
          <Text style={s.title}>{input.title}</Text>
          <Text style={s.date}>{input.dateLabel}</Text>
        </View>
        <Text id="contents" style={s.contents}>
          Contents
        </Text>
        {input.groups.map((group) => (
          <View key={group.heading.id}>
            <View style={s.tocRow} minPresenceAhead={30}>
              <Text style={[s.tocText, s.tocHeading]}>
                <Link src={`#${digestAnchor.heading(group.heading.id)}`} style={s.link}>
                  {group.heading.title}
                </Link>
              </Text>
              <Text style={[s.tocPage, s.tocHeading]}>{page(digestAnchor.heading(group.heading.id))}</Text>
            </View>
            {group.stories.map((story) => (
              <View key={story.id} style={s.tocRow} wrap={false}>
                <Text style={[s.tocText, s.tocStory]}>
                  <Link src={`#${digestAnchor.story(story.id)}`} style={s.link}>
                    {story.headline}
                  </Link>
                </Text>
                <Text style={[s.tocPage, s.tocStory]}>{page(digestAnchor.story(story.id))}</Text>
              </View>
            ))}
          </View>
        ))}
        {input.ad && (
          <View wrap={false} style={{ marginTop: 22 }}>
            <Text style={s.adLabel}>ADVERTISEMENT</Text>
            <Link src={input.ad.href}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF primitive */}
              <Image src={{ data: input.ad.png, format: 'png' }} style={{ width: (adHeight * input.ad.width) / input.ad.height, height: adHeight, alignSelf: 'center' }} />
            </Link>
          </View>
        )}
      </Page>
      <Page size="LETTER" style={s.page} layout={chrome}>
        {input.groups.map((group) => (
          <View key={group.heading.id}>
            <Text id={digestAnchor.heading(group.heading.id)} style={s.section} minPresenceAhead={80}>
              {group.heading.title}
            </Text>
            {group.stories.map((story) => (
              <View key={story.id}>
                <Text id={digestAnchor.story(story.id)} style={s.headline} minPresenceAhead={50}>
                  {story.headline}
                </Text>
                <StoryBody html={story.bodyHtml} />
                {story.sources.map((source, i) => (
                  <Text key={i} style={s.source}>
                    Source:{' '}
                    {source.url ? (
                      <Link src={source.url} style={s.link}>
                        {source.name}
                      </Link>
                    ) : (
                      source.name
                    )}
                  </Text>
                ))}
                <Text style={s.storyEnd}>
                  {story.url ? (
                    <>
                      <Link src={story.url} style={s.link}>
                        Tobacco Reporter
                      </Link>
                      {'  ·  '}
                    </>
                  ) : null}
                  <Link src="#contents" style={s.link}>
                    Back to contents
                  </Link>
                </Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}

/**
 * pdf.js refuses to run when Array.prototype has enumerable extras. Under
 * `next dev`, Payload's schema push loads drizzle-kit, which adds an
 * enumerable `Array.prototype.random`. Making such methods non-enumerable
 * keeps them working and lets pdf.js run.
 */
function hideEnumerableArrayMethods() {
  for (const key in Array.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, key)
    if (descriptor?.enumerable && descriptor.configurable) Object.defineProperty(Array.prototype, key, { ...descriptor, enumerable: false })
  }
}

/** Page (1-based) of every named destination in a rendered PDF. */
async function destinationPages(pdf: Buffer, anchors: string[]): Promise<Map<string, number>> {
  hideEnumerableArrayMethods()
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = getDocument({ data: new Uint8Array(pdf), isEvalSupported: false, disableFontFace: true })
  try {
    const doc = await task.promise
    const pages = new Map<string, number>()
    for (const anchor of anchors) {
      const dest = await doc.getDestination(anchor)
      if (dest?.[0] && typeof dest[0] === 'object') pages.set(anchor, (await doc.getPageIndex(dest[0] as { num: number; gen: number })) + 1)
    }
    return pages
  } finally {
    await task.destroy()
  }
}

/**
 * Renders the PDF, reads where each heading and story landed, and renders
 * again with those page numbers in the contents. Adding the numbers does not
 * change the contents' length (they sit in a fixed-width column), but the
 * result is checked and re-rendered if anything moved.
 */
export async function renderDigestPdf(input: DigestInput): Promise<{ pdf: Buffer; pages: Map<string, number> }> {
  const anchors = input.groups.flatMap((g) => [digestAnchor.heading(g.heading.id), ...g.stories.map((st) => digestAnchor.story(st.id))])
  let pages = new Map<string, number>()
  for (let attempt = 0; attempt < 3; attempt++) {
    const pdf = await renderToBuffer(digestDocument(input, pages))
    const actual = await destinationPages(pdf, anchors)
    if (attempt > 0 && anchors.every((a) => actual.get(a) === pages.get(a))) return { pdf, pages: actual }
    pages = actual
  }
  throw new Error('The contents page numbers did not settle. Try generating again.')
}
