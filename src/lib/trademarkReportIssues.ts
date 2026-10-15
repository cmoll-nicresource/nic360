import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Payload, Where } from 'payload'
import type { Trademark } from '@/payload-types'
import { lexicalFromText } from '@/lib/lexical'
import { SITE_URL } from '@/lib/env'
import { requireCompleteTrademarkMonth } from './tmog/monthlyCoverage'
import {
  renderTrademarkPdf,
  reportDate,
  type ReportMark,
  type TrademarkReport,
} from './tmog/reportPdf'

export type TrademarkReportOptions = {
  /** Gazette issue date for imports; reporting date for manual generation. UTC date boundaries. */
  asOf?: Date
  weekly?: boolean
  /** Automatic monthly generation in the first reporting week of a month. */
  monthly?: boolean | 'auto'
}

export function trademarkReportPeriods(asOf: Date) {
  if (Number.isNaN(asOf.getTime())) throw new Error('Invalid reporting date.')
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() + 1))
  const start = new Date(end.getTime() - 7 * 86400000)
  const monthEnd = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1))
  const monthStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1, 1))
  return { start, end, monthStart, monthEnd }
}

async function allMarks(payload: Payload, where: Where): Promise<Trademark[]> {
  const marks: Trademark[] = []
  let page = 1
  for (;;) {
    const result = await payload.find({
      collection: 'trademarks',
      where,
      sort: 'title',
      depth: 1,
      limit: 500,
      page,
      overrideAccess: true,
    })
    marks.push(...result.docs)
    if (!result.hasNextPage) return marks
    page++
  }
}

/** Read only configured media storage; never fetch a URL supplied by a trademark record. */
async function withImages(
  payload: Payload,
  marks: Trademark[],
  cache: Map<number, Buffer | undefined>,
): Promise<ReportMark[]> {
  const result: ReportMark[] = []
  for (const mark of marks) {
    const media = mark.image && typeof mark.image === 'object' ? mark.image : undefined
    if (media?.filename && media.mimeType?.startsWith('image/')) {
      if (!cache.has(media.id)) {
        let image: Buffer | undefined
        try {
          let bytes: Buffer
          if (!process.env.S3_BUCKET) {
            const upload = payload.collections.media.config.upload
            if (!upload || typeof upload !== 'object' || !upload.staticDir)
              throw new Error('No local media directory')
            if (path.basename(media.filename) !== media.filename)
              throw new Error('Invalid filename')
            bytes = await fs.readFile(path.join(upload.staticDir, media.filename))
          } else {
            const origin = payload.config.serverURL || SITE_URL
            if (!origin) throw new Error('No server URL for stored media')
            const response = await fetch(
              new URL(`/api/media/file/${encodeURIComponent(media.filename)}`, origin),
              { signal: AbortSignal.timeout(8000), redirect: 'error' },
            )
            if (!response.ok || Number(response.headers.get('content-length')) > 10_000_000)
              throw new Error('Image unavailable')
            const chunks: Uint8Array[] = []
            let size = 0
            for await (const chunk of response.body!) {
              size += chunk.byteLength
              if (size > 10_000_000) throw new Error('Image too large')
              chunks.push(chunk)
            }
            bytes = Buffer.concat(chunks)
          }
          image = await sharp(bytes, { limitInputPixels: 25_000_000 })
            .resize({ width: 600, height: 400, fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer()
        } catch {
          // A missing or unsupported mark image must never hide the textual record.
          payload.logger.warn(`Trademark report: artwork unavailable for media ${media.id}`)
        }
        cache.set(media.id, image)
      }
      result.push({ ...mark, reportImage: cache.get(media.id) })
    } else result.push(mark)
  }
  return result
}

export async function buildTrademarkReportIssues(
  payload: Payload,
  options: TrademarkReportOptions = {},
): Promise<number[]> {
  const asOf = options.asOf ?? new Date()
  const { start, end, monthStart, monthEnd } = trademarkReportPeriods(asOf)
  const generateMonthly =
    options.monthly === true || (options.monthly !== false && asOf.getUTCDate() <= 7)
  // Validate before rendering, uploading, or creating any issue in this request.
  if (generateMonthly) await requireCompleteTrademarkMonth(payload, monthStart)
  const generatedAt = new Date()
  const issuesCreated: number[] = []
  const imageCache = new Map<number, Buffer | undefined>()
  const inPeriod = (field: string, from: Date, to: Date): Where => ({
    [field]: { greater_than_equal: from.toISOString(), less_than: to.toISOString() },
  })

  async function createReport(
    generator: string,
    report: Omit<TrademarkReport, 'title' | 'generatedAt'>,
    summary: string,
  ) {
    const { docs: pubs } = await payload.find({
      collection: 'publications',
      where: { generator: { equals: generator } },
      limit: 1,
      overrideAccess: true,
    })
    if (!pubs[0]) throw new Error(`No publication configured for ${generator}.`)
    const pdf = await renderTrademarkPdf({ ...report, title: pubs[0].title, generatedAt })
    const file = await payload.create({
      collection: 'guide-files',
      data: {},
      overrideAccess: true,
      file: {
        data: pdf,
        mimetype: 'application/pdf',
        name: `${generator}-${(report.kind === 'monthly' ? monthStart : asOf).toISOString().slice(0, report.kind === 'monthly' ? 7 : 10)}.pdf`,
        size: pdf.length,
      },
    })
    try {
      const issue = await payload.create({
        collection: 'publication-issues',
        overrideAccess: true,
        data: {
          publication: pubs[0].id,
          title: `${pubs[0].title} - ${report.period}`,
          issueDate: asOf.toISOString(),
          format: 'pdf-report',
          summary: lexicalFromText(summary),
          file: file.id,
          _status: 'draft',
        },
      })
      issuesCreated.push(issue.id)
    } catch (error) {
      await payload
        .delete({ collection: 'guide-files', id: file.id, overrideAccess: true })
        .catch(() => undefined)
      throw error
    }
  }

  if (options.weekly !== false) {
    const marks = await allMarks(payload, inPeriod('publishedDate', start, end))
    if (marks.length)
      await createReport(
        'weekly-trademark-report',
        {
          kind: 'weekly',
          period: `Week ending ${reportDate(asOf.toISOString())}`,
          sections: [
            {
              title: 'Published for opposition',
              dateField: 'publishedDate',
              marks: await withImages(payload, marks, imageCache),
            },
          ],
        },
        `${marks.length} marks published for opposition from ${reportDate(start.toISOString())} through ${reportDate(asOf.toISOString())}.`,
      )
  }
  if (generateMonthly) {
    const [published, cancelled, renewed] = await Promise.all([
      allMarks(payload, inPeriod('publishedDate', monthStart, monthEnd)),
      allMarks(payload, inPeriod('cancelledDate', monthStart, monthEnd)),
      allMarks(payload, inPeriod('renewedDate', monthStart, monthEnd)),
    ])
    if (published.length || cancelled.length || renewed.length)
      await createReport(
        'monthly-trademark-activity',
        {
          kind: 'monthly',
          period: new Intl.DateTimeFormat('en-US', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(monthStart),
          sections: [
            {
              title: 'Published for opposition',
              dateField: 'publishedDate',
              marks: await withImages(payload, published, imageCache),
            },
            {
              title: 'Cancellations',
              dateField: 'cancelledDate',
              marks: await withImages(payload, cancelled, imageCache),
            },
            {
              title: 'Renewals',
              dateField: 'renewedDate',
              marks: await withImages(payload, renewed, imageCache),
            },
          ],
        },
        `${published.length} marks published for opposition, ${cancelled.length} cancellations and ${renewed.length} renewals in ${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthStart)}.`,
      )
  }
  return issuesCreated
}
