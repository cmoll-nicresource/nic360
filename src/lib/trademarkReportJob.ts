import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'

import { lexicalFromText } from '@/lib/lexical'

const FIXTURE_PATH = path.resolve(process.cwd(), 'docs/sample-data/uspto-fixture.json')

const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
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

type FixtureRow = {
  serialNumber: string
  title: string
  class?: string
  owner?: string
  ownerAddress?: string
  style?: 'yes' | 'no' | 'na'
  design?: 'yes' | 'no' | 'na'
  publishedDate?: string
  filedDate?: string
  cancelledDate?: string
  renewedDate?: string
}

function resolveDaysAgo(value: string | undefined): string | undefined {
  if (!value) return undefined
  const match = /^DAYS_AGO:(\d+)$/.exec(value)
  if (!match) return value
  return new Date(Date.now() - Number(match[1]) * 24 * 60 * 60 * 1000).toISOString()
}

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

async function ensurePlaceholderImage(payload: Payload) {
  const { docs } = await payload.find({
    collection: 'media',
    where: { alt: { equals: 'Placeholder trademark filing image' } },
    limit: 1,
    overrideAccess: true,
  })
  if (docs[0]) return docs[0]

  const tmpPath = path.join(os.tmpdir(), 'nic360-trademark-job-placeholder.png')
  fs.writeFileSync(tmpPath, Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'))
  const doc = await payload.create({
    collection: 'media',
    data: { alt: 'Placeholder trademark filing image' },
    filePath: tmpPath,
    overrideAccess: true,
  })
  fs.unlinkSync(tmpPath)
  return doc
}

/**
 * Pulls the USPTO feed (a fixture file stands in for it), upserts Trademark
 * excerpts by serialNumber, and builds a draft weekly report issue (plus a
 * monthly one in the first week of the month). Logs everything to
 * TrademarkImportRuns. In production this would run on a schedule; here it's
 * triggered manually via /api/trademark-reports/run.
 */
export async function runTrademarkReportJob(payload: Payload) {
  const run = await payload.create({
    collection: 'trademark-import-runs',
    data: {
      startedAt: new Date().toISOString(),
      status: 'running',
      feedSource: `fixture:${path.basename(FIXTURE_PATH)}`,
    },
    overrideAccess: true,
  })

  try {
    const fixture: FixtureRow[] = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'))
    const placeholderImage = await ensurePlaceholderImage(payload)

    let newCount = 0
    let updatedCount = 0
    let renewals = 0
    let cancellations = 0

    for (const row of fixture) {
      const publishedDate = resolveDaysAgo(row.publishedDate)
      const cancelledDate = resolveDaysAgo(row.cancelledDate)
      const renewedDate = resolveDaysAgo(row.renewedDate)
      if (cancelledDate) cancellations += 1
      if (renewedDate) renewals += 1

      const data = {
        title: row.title,
        serialNumber: row.serialNumber,
        class: row.class,
        owner: row.owner,
        ownerAddress: row.ownerAddress,
        style: row.style,
        design: row.design,
        publishedDate,
        filedDate: resolveDaysAgo(row.filedDate),
        cancelledDate,
        renewedDate,
        image: placeholderImage.id,
        _status: 'published' as const,
      }

      const { docs: existing } = await payload.find({
        collection: 'trademarks',
        where: { serialNumber: { equals: row.serialNumber } },
        limit: 1,
        overrideAccess: true,
      })

      if (existing[0]) {
        await payload.update({ collection: 'trademarks', id: existing[0].id, data, overrideAccess: true })
        updatedCount += 1
      } else {
        await payload.create({ collection: 'trademarks', data, overrideAccess: true })
        newCount += 1
      }
    }

    const issuesCreated: number[] = []
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    const { docs: weeklyTrademarks } = await payload.find({
      collection: 'trademarks',
      where: { publishedDate: { greater_than_equal: new Date(oneWeekAgo).toISOString() } },
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
            summary: lexicalFromText(
              `${weeklyTrademarks.length} trademark(s) published for opposition in the past week.`,
            ),
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
                `${cancellations} cancellation(s) and ${renewals} renewal(s) in the previous month.`,
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

    const finished = await payload.update({
      collection: 'trademark-import-runs',
      id: run.id,
      data: {
        finishedAt: new Date().toISOString(),
        status: 'succeeded',
        counts: { new: newCount, updated: updatedCount, renewals, cancellations },
        issuesCreated,
      },
      overrideAccess: true,
    })

    return finished
  } catch (err) {
    await payload.update({
      collection: 'trademark-import-runs',
      id: run.id,
      data: {
        finishedAt: new Date().toISOString(),
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      },
      overrideAccess: true,
    })
    throw err
  }
}
