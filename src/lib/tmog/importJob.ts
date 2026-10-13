import type { Payload } from 'payload'

import { buildTrademarkReportIssues } from '@/lib/trademarkReportIssues'
import { candidateIssueDates, fetchSpecificIssue } from './fetchIssue'
import { parseTrademarkIssue, type ParsedTrademark } from './parseIssue'
import { createThrottle, fetchAndStoreTrademarkImage } from './images'

const IMAGE_RATE_LIMIT_MS = 200 // ~5 requests/second

type TrademarkUpdateData = {
  title: string
  serialNumber: string
  goods?: string
  _status: 'published'
  owner?: string
  registrationNumber?: string
  publishedDate?: string
  registeredDate?: string
  cancelledDate?: string
  renewedDate?: string
  renewal?: { owner?: string | null; address?: string | null }
  image?: number
}

type Counts = {
  new: number
  updated: number
  published: number
  registered: number
  renewals: number
  cancellations: number
  imagesSaved: number
  imagesMissing: number
}

function blankCounts(): Counts {
  return { new: 0, updated: 0, published: 0, registered: 0, renewals: 0, cancellations: 0, imagesSaved: 0, imagesMissing: 0 }
}

async function upsertTrademark(
  payload: Payload,
  record: ParsedTrademark,
  issueDate: string,
  throttle: () => Promise<void>,
  counts: Counts,
) {
  const { docs: existing } = await payload.find({
    collection: 'trademarks',
    where: { serialNumber: { equals: record.serial } },
    limit: 1,
    overrideAccess: true,
  })

  const data: TrademarkUpdateData = {
    title: record.markText,
    serialNumber: record.serial,
    goods: record.goods || undefined,
    _status: 'published',
  }
  if (record.owner) data.owner = record.owner
  if (record.registrationNumber) data.registrationNumber = record.registrationNumber

  switch (record.status) {
    case 'published':
      data.publishedDate = record.statusDate
      counts.published += 1
      break
    case 'registered':
      data.registeredDate = record.statusDate
      counts.registered += 1
      break
    case 'cancelled':
      data.cancelledDate = record.statusDate
      counts.cancellations += 1
      break
    case 'renewed':
      data.renewedDate = record.statusDate
      // Merge rather than replace, so any manually-entered renewal.address isn't wiped out.
      if (record.owner) data.renewal = { ...(existing[0]?.renewal ?? {}), owner: record.owner }
      counts.renewals += 1
      break
  }

  if (record.imageFileName) {
    const outcome = await fetchAndStoreTrademarkImage(
      payload,
      { serial: record.serial, issueDate, markText: record.markText },
      throttle,
    )
    if ('mediaId' in outcome) {
      data.image = outcome.mediaId
      counts.imagesSaved += 1
    } else if ('missing' in outcome) {
      counts.imagesMissing += 1
    } else {
      // Retries exhausted for a non-404 error — leave the image blank rather than fail the run.
      counts.imagesMissing += 1
    }
  }

  if (existing[0]) {
    await payload.update({ collection: 'trademarks', id: existing[0].id, data, overrideAccess: true })
    counts.updated += 1
  } else {
    await payload.create({ collection: 'trademarks', data, overrideAccess: true })
    counts.new += 1
  }
}

export type TmogImportResult = {
  skipped?: true
  issueDate?: string
  run?: unknown
}

/**
 * Imports one TMOG issue's class-34 trademarks: resolves which issue to
 * process (or uses `onlyIssueDate` for a manual re-run), streams and filters
 * the XML, upserts `trademarks`, fetches images (throttled, missing-on-404
 * tolerated), and logs everything to `trademark-import-runs`.
 *
 * Idempotent: if `onlyIssueDate` is omitted, candidates that already have a
 * succeeded run are skipped without doing any work.
 */
export async function runTmogImportJob(payload: Payload, onlyIssueDate?: string): Promise<TmogImportResult> {
  const candidates = onlyIssueDate ? [onlyIssueDate] : candidateIssueDates()

  for (const issueDate of candidates) {
    if (!onlyIssueDate) {
      const { totalDocs } = await payload.find({
        collection: 'trademark-import-runs',
        where: { and: [{ issueDate: { equals: isoFromYYYYMMDD(issueDate) } }, { status: { equals: 'succeeded' } }] },
        limit: 0,
        overrideAccess: true,
      })
      if (totalDocs > 0) {
        return { skipped: true, issueDate }
      }
    }

    const fetched = await fetchSpecificIssue(issueDate)
    if (!fetched) continue // not posted yet (or genuinely missing for a manual date) — try the next candidate

    const run = await payload.create({
      collection: 'trademark-import-runs',
      data: {
        issueDate: isoFromYYYYMMDD(issueDate),
        startedAt: new Date().toISOString(),
        status: 'running',
        feedSource: fetched.url,
      },
      overrideAccess: true,
    })

    try {
      const counts = blankCounts()
      const throttle = createThrottle(IMAGE_RATE_LIMIT_MS)

      for await (const record of parseTrademarkIssue(fetched.response.body!)) {
        await upsertTrademark(payload, record, issueDate, throttle, counts)
      }

      const issuesCreated = await buildTrademarkReportIssues(payload, {
        cancellations: counts.cancellations,
        renewals: counts.renewals,
      })

      const finished = await payload.update({
        collection: 'trademark-import-runs',
        id: run.id,
        data: {
          finishedAt: new Date().toISOString(),
          status: 'succeeded',
          counts,
          issuesCreated,
        },
        overrideAccess: true,
      })

      return { issueDate, run: finished }
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

  // Every candidate 404'd (not posted yet) or was already done.
  const failedRun = await payload.create({
    collection: 'trademark-import-runs',
    data: {
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'failed',
      feedSource: 'https://cdn.uspto.gov/doc/TMOGIssue_*',
      error: onlyIssueDate
        ? `Issue ${onlyIssueDate} hasn't been posted yet.`
        : `No un-processed TMOG issue found in the last ${candidates.length} week(s) (tried: ${candidates.join(', ')}).`,
    },
    overrideAccess: true,
  })

  return { run: failedRun }
}

function isoFromYYYYMMDD(yyyymmdd: string): string {
  const y = yyyymmdd.slice(0, 4)
  const m = yyyymmdd.slice(4, 6)
  const d = yyyymmdd.slice(6, 8)
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`).toISOString()
}
