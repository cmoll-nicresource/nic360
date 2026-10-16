import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'

import { isAdSlotBeforeIndex } from '@/lib/publicationAds'
import type { Publication, PublicationAd, PublicationIssue } from '@/payload-types'
import { SITE_URL } from '@/lib/env'

// Email clients have poor/inconsistent CSS support (no external stylesheets,
// patchy flexbox/grid, Outlook renders with Word's engine), so this whole
// file sticks to inline styles on a table-based layout and web-safe fonts —
// no @font-face, no classes, nothing that depends on a <style> block or an
// external font actually loading. Colors/fonts otherwise match
// src/app/(frontend)/styles.css's --nrc-* palette.
const COLOR = {
  primaryDark: '#1c4066',
  primary: '#285888',
  ink: '#1a2330',
  muted: '#5b6878',
  border: '#d8dee6',
  bg: '#f7f8fa',
}
const FONT_SANS = 'Arial, Helvetica, sans-serif'
const FONT_SERIF = "Georgia, 'Times New Roman', serif"

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function excerptUrl(relationTo: string, id: number): string {
  return `${SITE_URL}/${relationTo}/${id}`
}

function sectionHeadingHtml(text: string): string {
  return `<div style="font-family:${FONT_SERIF};font-size:17px;font-weight:700;color:${COLOR.primaryDark};margin:24px 0 8px;">${escapeHtml(text)}</div>`
}

function listItemHtml(url: string, title: string): string {
  return `<div style="padding:10px 0;border-bottom:1px solid ${COLOR.border};"><a href="${url}" style="color:${COLOR.primary};text-decoration:none;font-size:15px;font-weight:600;font-family:${FONT_SANS};">${escapeHtml(title)}</a></div>`
}

function renderAdHtml(ad: PublicationAd): string {
  const image = typeof ad.image === 'object' ? ad.image : null
  const imageUrl = image?.url ? new URL(image.url, SITE_URL).href : ''
  const alt = image?.alt || 'Advertisement'
  const clickUrl = `${SITE_URL}/api/ads/${ad.id}/click`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr><td align="center" style="background:${COLOR.bg};border:1px solid ${COLOR.border};border-radius:8px;padding:6px;">
      <a href="${clickUrl}" style="display:block;"><img src="${imageUrl}" alt="${escapeHtml(alt)}" width="100%" style="display:block;width:100%;max-width:576px;border-radius:6px;"></a>
      <div style="font-family:${FONT_SANS};font-size:10px;color:${COLOR.muted};text-align:center;text-transform:uppercase;letter-spacing:0.04em;padding:4px 0 2px;">Advertisement</div>
    </td></tr>
  </table>`
}

function downloadButtonHtml(fileUrl: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr><td style="background:${COLOR.primary};border-radius:6px;">
      <a href="${fileUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-family:${FONT_SANS};font-weight:700;font-size:14px;">Download the full report (PDF)</a>
    </td></tr>
  </table>`
}

/**
 * Items are flattened across all sections (not restarted per section) when
 * deciding ad placement — there's only one "story 1" in the whole issue —
 * so an ad slot can land right after a section heading if that's where the
 * running count lands. Stacked <div>s instead of <ul><li> for list rows:
 * simpler to inline-style and avoids email clients' inconsistent bullet
 * rendering.
 */
function renderExcerptListBody(issue: PublicationIssue, ads: PublicationAd[]): string {
  const introHtml = issue.intro ? convertLexicalToHTML({ data: issue.intro }) : ''

  let itemIndex = 0
  let adIndex = 0
  const parts: string[] = []

  for (const section of issue.sections ?? []) {
    parts.push(sectionHeadingHtml(section.heading))

    for (const item of section.items ?? []) {
      if (isAdSlotBeforeIndex(itemIndex) && adIndex < ads.length) {
        parts.push(renderAdHtml(ads[adIndex]))
        adIndex++
      }

      if (typeof item.value === 'object' && item.value) {
        parts.push(listItemHtml(excerptUrl(item.relationTo, item.value.id), item.value.title))
      }
      itemIndex++
    }
  }

  return introHtml + parts.join('\n')
}

/** Renders an Issue into the email template for its format. Templates live in code. */
export function renderIssueEmailHtml(
  issue: PublicationIssue,
  publication: Publication,
  ads: PublicationAd[],
): string {
  const title = issue.email?.subject || issue.title
  const preheader = issue.email?.previewText
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(issue.email.previewText)}</div>`
    : ''

  if (issue.format === 'custom-html') {
    // Designed outside the CMS by staff; trusted (editor-role+) content, not sanitized further. No header/footer/ads/masthead — fully custom.
    return `<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>\n<body style="margin:0;padding:0;">\n${preheader}${issue.body || ''}\n</body>\n</html>`
  }

  let bodyHtml = ''
  if (issue.format === 'excerpt-list') {
    bodyHtml = renderExcerptListBody(issue, ads)
  } else if (issue.format === 'pdf-report') {
    const summaryHtml = issue.summary ? convertLexicalToHTML({ data: issue.summary }) : ''
    const fileUrl =
      issue.file && typeof issue.file === 'object' && issue.file.url
        ? new URL(issue.file.url, SITE_URL).href
        : null
    const adsHtml = ads.map(renderAdHtml).join('\n')
    bodyHtml = summaryHtml + adsHtml + (fileUrl ? downloadButtonHtml(fileUrl) : '')
  }

  const headerRow = publication.header
    ? `<tr><td style="padding:16px 32px 0;">${publication.header}</td></tr>`
    : ''
  const footerRow = publication.footer
    ? `<tr><td style="padding:16px 32px 28px;border-top:1px solid ${COLOR.border};">${publication.footer}</td></tr>`
    : ''

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid ${COLOR.border};border-radius:10px;overflow:hidden;">
<tr><td style="background:${COLOR.primaryDark};padding:24px 32px;">
<div style="font-family:${FONT_SERIF};font-size:22px;font-weight:700;color:#ffffff;">${escapeHtml(title)}</div>
</td></tr>
${headerRow}
<tr><td style="padding:28px 32px;font-family:${FONT_SANS};font-size:15px;line-height:1.6;color:${COLOR.ink};">
${bodyHtml}
</td></tr>
${footerRow}
</table>
</td></tr>
</table>
</body>
</html>`
}
