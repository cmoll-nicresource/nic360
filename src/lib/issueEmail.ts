import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'

import type { PublicationIssue } from '@/payload-types'
import { SITE_URL } from '@/lib/env'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function excerptUrl(relationTo: string, id: number): string {
  return `${SITE_URL}/${relationTo}/${id}`
}

/** Renders an Issue into the email template for its format. Templates live in code. */
export function renderIssueEmailHtml(issue: PublicationIssue): string {
  const title = issue.email?.subject || issue.title
  let bodyHtml = ''

  if (issue.format === 'excerpt-list') {
    const introHtml = issue.intro ? convertLexicalToHTML({ data: issue.intro }) : ''
    const sectionsHtml = (issue.sections ?? [])
      .map((section) => {
        const itemsHtml = (section.items ?? [])
          .map((item) => {
            if (typeof item.value !== 'object' || !item.value) return ''
            const url = excerptUrl(item.relationTo, item.value.id)
            return `<li><a href="${url}">${escapeHtml(item.value.title)}</a></li>`
          })
          .join('\n')
        return `<h2>${escapeHtml(section.heading)}</h2>\n<ul>\n${itemsHtml}\n</ul>`
      })
      .join('\n')
    bodyHtml = introHtml + sectionsHtml
  } else if (issue.format === 'pdf-report') {
    const summaryHtml = issue.summary ? convertLexicalToHTML({ data: issue.summary }) : ''
    const fileUrl = issue.file && typeof issue.file === 'object' ? `${SITE_URL}${issue.file.url}` : null
    bodyHtml = summaryHtml + (fileUrl ? `<p><a href="${fileUrl}">Download the full report (PDF)</a></p>` : '')
  } else if (issue.format === 'custom-html') {
    // Designed outside the CMS by staff; trusted (editor-role+) content, not sanitized further.
    bodyHtml = issue.body || ''
  }

  return `<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>\n<body>\n<h1>${escapeHtml(title)}</h1>\n${bodyHtml}\n</body>\n</html>`
}
