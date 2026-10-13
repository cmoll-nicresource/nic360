import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'

import { lexicalFromText } from '@/lib/lexical'

// A deliberately minimal but valid PDF, just to have real bytes behind the upload.
// The real report layout/content is out of scope here — this stands in until
// a proper PDF renderer is built.
const MINIMAL_PDF = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF`

async function createPlaceholderPdf(payload: Payload) {
  const tmpPath = path.join(os.tmpdir(), `nic360-report-${Date.now()}.pdf`)
  fs.writeFileSync(tmpPath, MINIMAL_PDF)
  const doc = await payload.create({
    collection: 'guide-files',
    data: {},
    filePath: tmpPath,
    overrideAccess: true,
  })
  fs.unlinkSync(tmpPath)
  return doc
}

/**
 * Drafts the Weekly US Trademark Report (if any trademark was published this
 * past week) and, in the first week of the month, the Monthly US Trademark
 * Activity report (if any cancellation or renewal happened last month).
 * Shared by both the fixture-based job and the real USPTO importer — both
 * upsert the same `trademarks` fields (`publishedDate`/`cancelledDate`/
 * `renewedDate`), so the same queries work for either data source.
 */
export async function buildTrademarkReportIssues(
  payload: Payload,
  recentCounts: { cancellations: number; renewals: number },
): Promise<number[]> {
  const issuesCreated: number[] = []

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const { docs: weeklyTrademarks } = await payload.find({
    collection: 'trademarks',
    where: { publishedDate: { greater_than_equal: oneWeekAgo.toISOString() } },
    limit: 500,
    overrideAccess: true,
  })
  if (weeklyTrademarks.length > 0) {
    const { docs: weeklyPubs } = await payload.find({
      collection: 'publications',
      where: { generator: { equals: 'weekly-trademark-report' } },
      limit: 1,
      overrideAccess: true,
    })
    if (weeklyPubs[0]) {
      const file = await createPlaceholderPdf(payload)
      const issue = await payload.create({
        collection: 'publication-issues',
        data: {
          publication: weeklyPubs[0].id,
          title: `${weeklyPubs[0].title} - ${new Date().toLocaleDateString()}`,
          issueDate: new Date().toISOString(),
          format: 'pdf-report',
          summary: lexicalFromText(`${weeklyTrademarks.length} trademark(s) published for opposition in the past week.`),
          file: file.id,
          _status: 'draft',
        },
        overrideAccess: true,
      })
      issuesCreated.push(issue.id)
    }
  }

  const now = new Date()
  if (now.getDate() <= 7) {
    const oneMonthAgo = new Date(now)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const { docs: monthlyTrademarks } = await payload.find({
      collection: 'trademarks',
      where: {
        or: [
          { cancelledDate: { greater_than_equal: oneMonthAgo.toISOString() } },
          { renewedDate: { greater_than_equal: oneMonthAgo.toISOString() } },
        ],
      },
      limit: 500,
      overrideAccess: true,
    })
    if (monthlyTrademarks.length > 0) {
      const { docs: monthlyPubs } = await payload.find({
        collection: 'publications',
        where: { generator: { equals: 'monthly-trademark-activity' } },
        limit: 1,
        overrideAccess: true,
      })
      if (monthlyPubs[0]) {
        const file = await createPlaceholderPdf(payload)
        const issue = await payload.create({
          collection: 'publication-issues',
          data: {
            publication: monthlyPubs[0].id,
            title: `${monthlyPubs[0].title} - ${now.toLocaleDateString()}`,
            issueDate: now.toISOString(),
            format: 'pdf-report',
            summary: lexicalFromText(
              `${recentCounts.cancellations} cancellation(s) and ${recentCounts.renewals} renewal(s) in the previous month.`,
            ),
            file: file.id,
            _status: 'draft',
          },
          overrideAccess: true,
        })
        issuesCreated.push(issue.id)
      }
    }
  }

  return issuesCreated
}
