import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { isAdSlotBeforeIndex } from '@/lib/publicationAds'
import {
  editionItem,
  editionSections,
  editionWebPath,
  publicationHttpUrl,
} from '@/lib/publicationEdition'
import { formatDate } from '@/lib/formatDate'
import { sentenceCase } from '@/lib/textCase'
import type { Article, Publication, PublicationAd, PublicationIssue } from '@/payload-types'
import { SITE_URL } from '@/lib/env'

// Inline styles, tables and web-safe fonts carry the design in Outlook.
// The media query is an enhancement; all content remains readable without it.
const C = {
  navy: '#1c4066',
  blue: '#285888',
  teal: '#337b89',
  ink: '#253547',
  muted: '#596a7b',
  border: '#dce4eb',
  bg: '#edf1f4',
  pale: '#f3f6f8',
}
const SANS = 'Arial, Helvetica, sans-serif'
const SERIF = "Georgia, 'Times New Roman', serif"
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}
function absolute(path: string) {
  return new URL(path, SITE_URL).href
}
function headingLabel(value: string) {
  return value.split(': ').map(sentenceCase).join(' / ')
}
function link(url: string, label: string, style = '') {
  return `<a href="${escapeHtml(url)}" style="color:${C.blue};text-decoration:underline;text-underline-offset:3px;${style}">${escapeHtml(label)}</a>`
}
function richText(data: Article['excerpt'] | null | undefined) {
  if (!data) return ''
  return convertLexicalToHTML({ data }).replace(
    /<(p|ul|ol|li|blockquote|h[1-6]|a|img)(\s[^>]*?)?>/gi,
    (_original, tag: string, attrs = '') => {
      const styles: Record<string, string> = {
        p: 'margin:0 0 12px;',
        ul: 'margin:0 0 12px;padding-left:22px;',
        ol: 'margin:0 0 12px;padding-left:22px;',
        li: 'margin:0 0 6px;',
        blockquote: `margin:12px 0;padding-left:16px;border-left:3px solid ${C.border};`,
        a: `color:${C.blue};text-decoration:underline;`,
        img: 'max-width:100%;height:auto;',
      }
      const style = styles[tag.toLowerCase()] || 'margin:16px 0 8px;font-size:18px;line-height:1.4;'
      return /style="/i.test(attrs)
        ? `<${tag}${attrs.replace(/style="([^"]*)"/i, (_: string, value: string) => `style="${value};${style}"`)}>`
        : `<${tag}${attrs} style="${style}">`
    },
  )
}

export function renderPublicationAdHtml(ad: PublicationAd): string {
  const image = typeof ad.image === 'object' ? ad.image : null
  const imageUrl = image?.url ? publicationHttpUrl(absolute(image.url)) : null
  if (!imageUrl) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 28px;"><tr><td align="center" style="padding:10px;background:${C.pale};"><div style="font:10px ${SANS};color:${C.muted};letter-spacing:1px;text-transform:uppercase;padding-bottom:8px;">Advertisement</div><a href="${escapeHtml(absolute(`/api/ads/${ad.id}/click`))}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(image?.alt || 'Advertisement')}" width="600" border="0" style="display:block;width:100%;max-width:600px;height:auto;"></a></td></tr></table>`
}

function renderItemHtml(item: NonNullable<ReturnType<typeof editionItem>>, headingTag = 'h3') {
  const eyebrow = [item.location, sentenceCase(item.subject)]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' &nbsp;·&nbsp; ')
  const metadata = item.fields.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pale};margin:16px 0 18px;table-layout:fixed;">${Array.from(
        { length: Math.ceil(item.fields.length / 2) },
        (_, index) =>
          `<tr>${item.fields
            .slice(index * 2, index * 2 + 2)
            .map(
              (field) =>
                `<td class="pub-meta-cell" width="50%" valign="top" style="padding:12px 14px;font:13px/1.5 ${SANS};overflow-wrap:break-word;word-wrap:break-word;"><div style="font:10px/1.4 ${SANS};font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${C.muted};margin-bottom:4px;">${escapeHtml(field.label)}</div>${field.href ? link(absolute(field.href), field.value!) : escapeHtml(field.value!)}</td>`,
            )
            .join('')}</tr>`,
      ).join('')}</table>`
    : ''
  const actions = item.actions.length
    ? `<div style="margin:20px 0 16px;"><div style="font:11px ${SANS};font-weight:700;color:${C.navy};letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">Recent activity</div><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${item.actions.map((action) => `<tr><td width="94" valign="top" style="padding:7px 8px 7px 0;border-top:1px solid ${C.border};font:11px/1.6 ${SANS};color:${C.muted};">${escapeHtml(formatDate(action.date))}</td><td valign="top" style="padding:7px 0;border-top:1px solid ${C.border};font:12px/1.5 ${SANS};">${escapeHtml(action.action)}${action.actor ? ` — ${escapeHtml(action.actor)}` : ''}</td></tr>`).join('')}</table>${item.moreActions ? `<div style="margin-top:8px;font:12px ${SANS};">${link(absolute(item.href), 'View all activity →')}</div>` : ''}</div>`
    : ''
  const source = item.source
    ? item.sourceUrl
      ? link(item.sourceUrl, item.source)
      : escapeHtml(item.source)
    : ''
  const foot = [source, item.date ? escapeHtml(item.date) : '']
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;"><tr><td style="padding:22px 0 24px;border-bottom:1px solid ${C.border};color:${C.ink};overflow-wrap:break-word;word-wrap:break-word;">
${eyebrow ? `<div style="font:11px/1.6 ${SANS};font-weight:700;letter-spacing:.7px;color:${C.teal};text-transform:uppercase;margin-bottom:8px;">${eyebrow}</div>` : ''}
<${headingTag} style="font:700 22px/1.3 ${SERIF};margin:0 0 14px;">${link(absolute(item.href), item.title, `color:${C.navy};text-decoration:none;`)}</${headingTag}>
${metadata}<div style="font:15px/1.7 ${SANS};color:${C.ink};">${richText(item.content)}</div>${actions}
${foot ? `<div style="font:12px/1.6 ${SANS};color:${C.muted};margin-top:10px;">${foot}</div>` : ''}
<div style="font:12px/1.6 ${SANS};margin-top:10px;">${link(absolute(item.href), item.kind === 'bill' ? 'View legislation →' : 'Read on Nicotine360 →')}</div>
</td></tr></table>`
}

/** One content renderer for delivery, unsaved editor previews and subscriber web editions. */
export function renderExcerptListBody(
  issue: PublicationIssue,
  publication: Publication,
  ads: PublicationAd[],
): string {
  const sections = editionSections(issue)
  const contents =
    sections.length > 1
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pale};margin:0 0 28px;"><tr><td style="padding:16px 18px;"><div style="font:10px ${SANS};font-weight:700;letter-spacing:1px;color:${C.muted};text-transform:uppercase;margin-bottom:8px;">In this edition</div>${sections.map((section) => `${section.startsParent ? `<div style="font:700 13px/1.6 ${SANS};padding-top:8px;color:${C.navy};">${escapeHtml(headingLabel(section.parentHeading))}</div>` : ''}<div style="font:13px/1.6 ${SANS};padding:3px 0 3px ${section.parentHeading ? '14' : '0'}px;">${link('#' + section.anchor, headingLabel(section.subheading))}</div>`).join('')}</td></tr></table>`
      : ''
  const parts = [
    issue.intro
      ? `<div style="font:15px/1.7 ${SANS};margin-bottom:24px;">${richText(issue.intro)}</div>`
      : '',
    contents,
  ]
  let itemIndex = 0,
    adIndex = 0
  for (const [index, section] of sections.entries()) {
    if (section.startsParent)
      parts.push(`<h2 style="margin:${index ? '36' : '0'}px 0 14px;padding:12px 16px;background:${C.navy};color:#ffffff;font:700 21px/1.4 ${SANS};">${escapeHtml(headingLabel(section.parentHeading))}</h2>`)
    const headingTag = section.parentHeading ? 'h3' : 'h2'
    parts.push(
      `<table id="${section.anchor}" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${index && !section.startsParent ? '32' : '0'}px;border-top:2px solid ${C.navy};"><tr><td style="padding:14px 0 6px;"><${headingTag} style="margin:0;font:700 17px/1.4 ${SANS};color:${C.navy};"><span style="font:11px ${SANS};color:${C.teal};padding-right:10px;">${String(index + 1).padStart(2, '0')}</span>${escapeHtml(headingLabel(section.subheading))}</${headingTag}></td></tr></table>`,
    )
    for (const reference of section.items || []) {
      if (isAdSlotBeforeIndex(itemIndex) && adIndex < ads.length)
        parts.push(renderPublicationAdHtml(ads[adIndex++]))
      const item = editionItem(reference, publication)
      if (item) {
        const groupedBySubject = section.heading
          .split(': ')
          .some((heading) => heading.toLowerCase() === item.subject.toLowerCase())
        parts.push(renderItemHtml(groupedBySubject ? { ...item, subject: '' } : item, section.parentHeading ? 'h4' : 'h3'))
      }
      itemIndex++
    }
  }
  return parts.join('\n')
}

/** Existing queued sends retain their saved HTML; this renders new previews/sends. */
export function renderIssueEmailHtml(
  issue: PublicationIssue,
  publication: Publication,
  ads: PublicationAd[],
): string {
  const subject = issue.email?.subject || issue.title
  const preheader = issue.email?.previewText
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(issue.email.previewText)}</div>`
    : ''
  if (issue.format === 'custom-html')
    return `<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>\n<body style="margin:0;padding:0;">\n${preheader}${issue.body || ''}\n</body>\n</html>`
  const webPath = editionWebPath(issue, publication)
  const legislation = publication.category?.includes('legislation')
  const count = (issue.sections || []).reduce(
    (total, section) => total + (section.items?.length || 0),
    0,
  )
  let bodyHtml = ''
  if (issue.format === 'excerpt-list') bodyHtml = renderExcerptListBody(issue, publication, ads)
  else if (issue.format === 'pdf-report') {
    const fileUrl =
      issue.file && typeof issue.file === 'object' && issue.file.url
        ? publicationHttpUrl(absolute(issue.file.url))
        : null
    bodyHtml =
      richText(issue.summary) +
      ads.map(renderPublicationAdHtml).join('\n') +
      (fileUrl
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td bgcolor="${C.blue}" style="padding:14px 20px;">${link(fileUrl, 'Download the full report (PDF)', `font:700 14px ${SANS};color:#ffffff;text-decoration:none;`)}</td></tr></table>`
        : '')
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(subject)}</title>
<style>@media only screen and (max-width:520px){.pub-pad{padding-left:20px!important;padding-right:20px!important}.pub-title{font-size:29px!important}.pub-meta-cell{display:block!important;width:auto!important}.pub-outer{padding:12px 0!important}}a:focus{outline:2px solid ${C.teal};outline-offset:3px}</style>
</head><body style="margin:0;padding:0;background:${C.bg};color:${C.ink};">${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};"><tr><td class="pub-outer" align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="680" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background:#ffffff;border-top:4px solid ${C.navy};">
<tr><td class="pub-pad" style="padding:24px 32px 22px;border-bottom:1px solid ${C.border};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle"><a href="${escapeHtml(SITE_URL)}"><img src="${escapeHtml(absolute('/logo.png'))}" width="168" alt="Nicotine360" border="0" style="display:block;width:168px;max-width:100%;height:auto;"></a></td><td align="right" valign="middle" style="font:11px/1.6 ${SANS};color:${C.muted};">${escapeHtml(formatDate(issue.issueDate))}${webPath ? `<br>${link(absolute(webPath), 'View web edition')}` : ''}</td></tr></table></td></tr>
<tr><td class="pub-pad" style="padding:28px 32px 24px;border-bottom:3px solid ${C.teal};"><div style="font:10px ${SANS};font-weight:700;letter-spacing:1.7px;color:${C.teal};text-transform:uppercase;margin-bottom:12px;">${legislation ? 'Legislative intelligence' : 'Industry intelligence'}</div><h1 class="pub-title" style="font:700 36px/1.15 ${SERIF};color:${C.navy};margin:0 0 14px;">${escapeHtml(publication.title || issue.title)}</h1>${publication.description ? `<p style="font:14px/1.65 ${SANS};color:${C.muted};margin:0 0 14px;">${escapeHtml(publication.description)}</p>` : ''}${issue.title && !issue.title.toLowerCase().startsWith((publication.title || '').toLowerCase()) ? `<p style="font:700 14px/1.6 ${SANS};margin:0 0 12px;">${escapeHtml(issue.title)}</p>` : ''}${issue.format === 'excerpt-list' && count ? `<div style="font:11px ${SANS};color:${C.muted};">${count} ${legislation ? (count === 1 ? 'update' : 'updates') : count === 1 ? 'story' : 'stories'} &nbsp;·&nbsp; ${issue.sections?.length || 0} ${(issue.sections?.length || 0) === 1 ? 'section' : 'sections'}</div>` : ''}</td></tr>
${publication.header ? `<tr><td class="pub-pad" style="padding:24px 32px 0;font:14px/1.6 ${SANS};">${publication.header}</td></tr>` : ''}
<tr><td class="pub-pad" style="padding:28px 32px 32px;font:15px/1.7 ${SANS};color:${C.ink};">${bodyHtml}</td></tr>
${publication.footer ? `<tr><td class="pub-pad" style="padding:20px 32px;border-top:1px solid ${C.border};font:13px/1.6 ${SANS};">${publication.footer}</td></tr>` : ''}
<tr><td class="pub-pad" style="padding:20px 32px;background:${C.pale};font:12px/1.7 ${SANS};color:${C.muted};"><strong style="color:${C.navy};">Nicotine360</strong><br>A publication of the Nicotine Resource Consortium</td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
}
