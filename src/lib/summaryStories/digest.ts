/**
 * Pure helpers for the weekly Executive Summary: which week an issue covers,
 * ordering stories under the weekly headings, and turning a story's stored
 * (already sanitized) HTML into blocks the PDF renderer can lay out.
 * See docs/executive-summary-stories.md.
 */
import { decodeHtmlEntities } from './entities'

const DAY = 86_400_000

/**
 * The seven calendar days ending on the issue's date (Saturday through
 * Friday for a Friday issue). Issue dates are stored as a day (noon UTC by
 * default), so the range is compared on calendar days in UTC.
 */
export function weekRange(issueDate: string): { from: string; to: string; firstDay: string; lastDay: string } {
  const parsed = new Date(issueDate)
  if (!Number.isFinite(parsed.getTime())) throw new Error('Set a valid issue date first.')
  const lastDay = parsed.toISOString().slice(0, 10)
  const end = Date.parse(`${lastDay}T00:00:00Z`)
  const firstDay = new Date(end - 6 * DAY).toISOString().slice(0, 10)
  return { from: `${firstDay}T00:00:00.000Z`, to: new Date(end + DAY).toISOString(), firstDay, lastDay }
}

/** Story ids from the week's daily issues, oldest issue first, in each issue's running order, without repeats. */
export function collectWeekStoryIds(issues: { issueDate: string; stories?: unknown[] | null }[]): number[] {
  const seen = new Set<number>()
  const ids: number[] = []
  for (const issue of [...issues].sort((a, b) => Date.parse(a.issueDate) - Date.parse(b.issueDate))) {
    for (const story of issue.stories ?? []) {
      const id = story && typeof story === 'object' ? (story as { id?: unknown }).id : story
      if (typeof id === 'number' && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
  }
  return ids
}

export type HeadingRef = { id: number; title: string }
export type StoryGroup<S> = { heading: HeadingRef | null; stories: S[] }

/**
 * Groups stories under the headings in heading order, keeping the stories'
 * own order within each group. Stories with no heading (or a deleted one)
 * come first, under `heading: null`, so they are noticed. Empty headings are left out.
 */
export function groupByHeading<S>(stories: S[], headingOf: (story: S) => number | null | undefined, headings: HeadingRef[]): StoryGroup<S>[] {
  const known = new Map(headings.map((h) => [h.id, h]))
  const buckets = new Map<number | null, S[]>()
  for (const story of stories) {
    const id = headingOf(story)
    const key = id != null && known.has(id) ? id : null
    buckets.set(key, [...(buckets.get(key) ?? []), story])
  }
  const groups: StoryGroup<S>[] = []
  if (buckets.get(null)?.length) groups.push({ heading: null, stories: buckets.get(null)! })
  for (const heading of headings) if (buckets.get(heading.id)?.length) groups.push({ heading, stories: buckets.get(heading.id)! })
  return groups
}

/** The flat order the PDF uses: grouped by heading as above. */
export function orderByHeading<S>(stories: S[], headingOf: (story: S) => number | null | undefined, headings: HeadingRef[]): S[] {
  return groupByHeading(stories, headingOf, headings).flatMap((group) => group.stories)
}

export type PdfRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string }
export type PdfBlock =
  | { kind: 'paragraph'; runs: PdfRun[] }
  | { kind: 'heading'; runs: PdfRun[] }
  | { kind: 'quote'; runs: PdfRun[] }
  | { kind: 'item'; marker: string; depth: number; runs: PdfRun[] }

/**
 * Converts story HTML (the sanitized subset: p, br, strong, em, u, sup, sub,
 * a, ul, ol, li, blockquote, h2–h4) into paragraphs of styled runs. Text
 * outside any block becomes its own paragraph; unknown tags are ignored and
 * their text kept.
 */
export function htmlToPdfBlocks(html: string): PdfBlock[] {
  const blocks: PdfBlock[] = []
  const style = { bold: 0, italic: 0, underline: 0 }
  const links: string[] = []
  const lists: { ordered: boolean; count: number }[] = []
  let current: PdfBlock | null = null
  let quote = 0

  const open = (block: PdfBlock) => {
    close()
    current = block
  }
  const close = () => {
    if (current) {
      // Trim the block's outer whitespace and drop it if nothing is left.
      const runs = current.runs
      if (runs.length) {
        runs[0].text = runs[0].text.replace(/^\s+/, '')
        runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '')
      }
      current.runs = runs.filter((r) => r.text)
      if (current.runs.length) blocks.push(current)
    }
    current = null
  }
  const add = (text: string) => {
    if (!text) return
    if (!current) {
      if (!text.trim()) return
      current = quote ? { kind: 'quote', runs: [] } : { kind: 'paragraph', runs: [] }
    }
    const run: PdfRun = { text }
    if (style.bold) run.bold = true
    if (style.italic) run.italic = true
    if (style.underline) run.underline = true
    if (links.length) run.href = links[links.length - 1]
    const last: PdfRun | undefined = current.runs[current.runs.length - 1]
    if (last && last.bold === run.bold && last.italic === run.italic && last.underline === run.underline && last.href === run.href) last.text += text
    else current.runs.push(run)
  }

  for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9]*)([^>]*)>|([^<]+)/gi)) {
    const [, slash, rawTag, attrs, text] = match
    if (text !== undefined) {
      add(decodeHtmlEntities(text).replace(/\s+/g, ' '))
      continue
    }
    const tag = rawTag.toLowerCase()
    const closing = slash === '/'
    switch (tag) {
      case 'p':
        if (closing) close()
        else open(quote ? { kind: 'quote', runs: [] } : { kind: 'paragraph', runs: [] })
        break
      case 'h2':
      case 'h3':
      case 'h4':
        if (closing) close()
        else open({ kind: 'heading', runs: [] })
        break
      case 'blockquote':
        close()
        quote = Math.max(0, quote + (closing ? -1 : 1))
        break
      case 'ul':
      case 'ol':
        close()
        if (closing) lists.pop()
        else lists.push({ ordered: tag === 'ol', count: 0 })
        break
      case 'li':
        if (closing) close()
        else {
          const list = lists[lists.length - 1]
          if (list) list.count++
          open({ kind: 'item', marker: list?.ordered ? `${list.count}.` : '•', depth: Math.max(lists.length - 1, 0), runs: [] })
        }
        break
      case 'br':
        add('\n')
        break
      case 'strong':
      case 'b':
        style.bold = Math.max(0, style.bold + (closing ? -1 : 1))
        break
      case 'em':
      case 'i':
        style.italic = Math.max(0, style.italic + (closing ? -1 : 1))
        break
      case 'u':
        style.underline = Math.max(0, style.underline + (closing ? -1 : 1))
        break
      case 'a':
        if (closing) links.pop()
        else {
          const href = /href="([^"]*)"/i.exec(attrs)?.[1]
          const url = href ? decodeHtmlEntities(href) : ''
          links.push(/^(https?:|mailto:)/i.test(url) ? url : (links[links.length - 1] ?? ''))
        }
        break
      default:
        break
    }
  }
  close()
  // An empty href means "no link" (from an unsafe or missing href).
  for (const block of blocks) for (const run of block.runs) if (!run.href) delete run.href
  return blocks
}

/** Problems that should stop the PDF being generated, in words an editor can act on. */
export function digestProblems(stories: { headline: string; heading: number | null | undefined }[], headings: HeadingRef[]): string[] {
  const known = new Set(headings.map((h) => h.id))
  const problems: string[] = []
  if (!stories.length) problems.push('Add stories first (use "Add this week\'s DES stories").')
  const unfiled = stories.filter((s) => s.heading == null || !known.has(s.heading))
  if (unfiled.length)
    problems.push(
      `${unfiled.length} ${unfiled.length === 1 ? 'story has' : 'stories have'} no weekly heading: ${unfiled
        .slice(0, 3)
        .map((s) => `"${s.headline}"`)
        .join(', ')}${unfiled.length > 3 ? '…' : ''}`,
    )
  return problems
}
