import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'
import { publicationIssueTitle } from '../publicationIssueTitle'

import { lexicalFromText } from '@/lib/lexical'

import type { Flow } from './columns'
import { withTransaction } from './db'
import { loadMonthlyFile, type LoadResult } from './monthly'
import { type Inputs, buildReport } from './report/chapters'
import { renderPdf } from './report/pdf'
import { syncDatasetForYear } from './syncDatasets'
import { resolveReportInputs } from './reportInputs'

export type UploadedFile = { fileName: string; buffer: Buffer }

export interface RunTradeReportJobOptions {
  importFile?: UploadedFile
  exportFile?: UploadedFile
  year?: number
  inputs?: Inputs
  /**
   * The web upload flow always confirms "this month already has rows" via
   * its own preview step before calling this (see
   * src/app/api/trade-reports/import-confirm/route.ts), so — unlike the
   * CLI's interactive y/N prompt — reaching this function at all already
   * means the editor meant to replace it.
   */
  replaceExisting?: boolean
}

export interface TradeReportJobResult {
  runId: number
  status: 'succeeded' | 'failed'
  loaded: LoadResult[]
  issuesCreated: number[]
  error?: string
}

/**
 * Loads the uploaded Imp_/Exp_ Census files, refreshes the US Imports/US
 * Exports Datasets for the years touched, generates the Trade Barometer PDF
 * for the most recent month loaded, and drafts it as a Publication Issue —
 * mirroring src/lib/trademarkReportJob.ts's shape (a logged run record,
 * draft issues the editor reviews/sends themselves).
 */
export async function runTradeReportJob(
  payload: Payload,
  opts: RunTradeReportJobOptions,
): Promise<TradeReportJobResult> {
  const run = await payload.create({
    collection: 'trade-import-runs',
    data: {
      startedAt: new Date().toISOString(),
      status: 'running',
      files: { import: opts.importFile?.fileName, export: opts.exportFile?.fileName },
    },
    overrideAccess: true,
  })

  const loaded: LoadResult[] = []
  const notes: string[] = []
  const issuesCreated: number[] = []

  try {
    // Imports first if both are given (matches the CLI's oldest-first sort
    // in practice, since a month's import/export files arrive together) —
    // each file is its own transaction, so one failing doesn't affect the other.
    const files = [opts.importFile, opts.exportFile].filter((f): f is UploadedFile => Boolean(f))
    for (const file of files) {
      const result = await withTransaction(payload, (c) =>
        loadMonthlyFile(c, file.fileName, file.buffer, {
          year: opts.year,
          confirmReplace: async () => opts.replaceExisting ?? true,
        }),
      )
      if (!result) continue
      loaded.push(result)
      const tag = `${result.flow} ${result.yr}-${String(result.mo).padStart(2, '0')}`
      for (const issue of result.issues) {
        notes.push(`${tag}: ${issue.kind}${issue.detail ? ` — ${issue.detail}` : ''}`)
      }
      if (result.ytdCheck) notes.push(`${tag}: ${result.ytdCheck}`)
    }

    // Refresh the flat Datasets for every (flow, year) combination touched.
    const years = new Set(loaded.map((r) => r.yr))
    const flows = new Set(loaded.map((r) => r.flow))
    for (const yr of years) {
      for (const flow of flows) {
        const sync = await syncDatasetForYear(payload, flow as Flow, yr)
        if (sync.skipped) notes.push(`Dataset sync (${flow} ${yr}): ${sync.skipped}`)
      }
    }

    // Generate the report for the most recently loaded month.
    const latest = [...loaded].sort((a, b) => a.yr * 12 + a.mo - (b.yr * 12 + b.mo)).pop()
    if (latest) {
      const issueId = await generateReportIssue(
        payload,
        latest.yr,
        latest.mo,
        opts.inputs ?? {},
        notes,
      )
      if (issueId) issuesCreated.push(issueId)
    }

    const countOf = (flow: Flow, field: 'rows' | 'replaced') =>
      loaded.find((r) => r.flow === flow)?.[field] ?? 0
    const countIssues = (kind: string) =>
      loaded.reduce(
        (n, r) =>
          n + r.issues.filter((i) => i.kind === kind).reduce((s, i) => s + (i.rowCount ?? 0), 0),
        0,
      )

    const finished = await payload.update({
      collection: 'trade-import-runs',
      id: run.id,
      data: {
        finishedAt: new Date().toISOString(),
        status: 'succeeded',
        counts: {
          importRows: countOf('import', 'rows'),
          exportRows: countOf('export', 'rows'),
          importReplaced: countOf('import', 'replaced'),
          exportReplaced: countOf('export', 'replaced'),
          newHtsCodes: countIssues('new_hts_code'),
          newCountries: countIssues('new_country_code'),
        },
        dataQualityNotes: notes.map((note) => ({ note })),
        issuesCreated,
      },
      overrideAccess: true,
    })

    return { runId: finished.id, status: 'succeeded', loaded, issuesCreated }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await payload.update({
      collection: 'trade-import-runs',
      id: run.id,
      data: {
        finishedAt: new Date().toISOString(),
        status: 'failed',
        error: message,
        dataQualityNotes: notes.map((note) => ({ note })),
        issuesCreated,
      },
      overrideAccess: true,
    })
    return { runId: run.id, status: 'failed', loaded, issuesCreated, error: message }
  }
}

function writeTempFile(buffer: Buffer, ext: string): string {
  const tmpPath = path.join(
    os.tmpdir(),
    `trade-barometer-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
  )
  fs.writeFileSync(tmpPath, buffer)
  return tmpPath
}

async function uploadGuideFile(payload: Payload, buffer: Buffer, ext: string): Promise<number> {
  const tmpPath = writeTempFile(buffer, ext)
  try {
    const doc = await payload.create({
      collection: 'guide-files',
      data: {},
      filePath: tmpPath,
      overrideAccess: true,
    })
    return doc.id
  } finally {
    fs.unlinkSync(tmpPath)
  }
}

async function generateReportIssue(
  payload: Payload,
  yr: number,
  mo: number,
  inputs: Inputs,
  notes: string[],
): Promise<number | null> {
  const { docs: pubs } = await payload.find({
    collection: 'publications',
    where: { generator: { equals: 'monthly-trade-barometer' } },
    limit: 1,
    overrideAccess: true,
  })
  const publication = pubs[0]
  if (!publication) {
    throw new Error(
      'No publication with generator "monthly-trade-barometer" found; a complete report issue cannot be created.',
    )
  }

  const resolved = await resolveReportInputs(inputs, yr, mo)
  if (resolved.inputs.usTrade?.source)
    notes.push(`US trade source snapshot (billions): ${JSON.stringify(resolved.inputs.usTrade)}`)
  if (resolved.inputs.trq?.source)
    notes.push(`CBP TRQ source snapshot (kilograms): ${JSON.stringify(resolved.inputs.trq)}`)
  notes.push(...resolved.notes)
  if (resolved.notes.length)
    throw new Error(`Cannot generate a complete PDF. ${resolved.notes.join(' ')}`)
  const client = await payload.db.pool.connect()
  let report: Awaited<ReturnType<typeof buildReport>>
  try {
    report = await buildReport(client, yr, mo, resolved.inputs)
  } finally {
    client.release()
  }
  notes.push(...report.notes)

  const pdfBuffer = await renderPdf(report)
  const pdfFileId = await uploadGuideFile(payload, pdfBuffer, 'pdf')

  const issue = await payload.create({
    collection: 'publication-issues',
    data: {
      publication: publication.id,
      title: publicationIssueTitle(
        publication.title,
        'monthly',
        new Date(),
        new Date(Date.UTC(yr, mo - 1, 1)),
      ),
      issueDate: new Date(Date.UTC(yr, mo - 1, 1)).toISOString(),
      format: 'pdf-report',
      summary: lexicalFromText(
        report.notes.length > 0
          ? `Generated with ${report.notes.length} data note(s) to review before sending.`
          : "Generated from this month's Census trade data.",
      ),
      file: pdfFileId,
      _status: 'draft',
    },
    overrideAccess: true,
  })
  return issue.id
}
