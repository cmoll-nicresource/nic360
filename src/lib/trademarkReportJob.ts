import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'

import { buildTrademarkReportIssues } from '@/lib/trademarkReportIssues'

const FIXTURE_PATH = path.resolve(process.cwd(), 'docs/sample-data/uspto-fixture.json')

const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

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

    const issuesCreated = await buildTrademarkReportIssues(payload, { cancellations, renewals })

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
