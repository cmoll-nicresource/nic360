import dotenv from 'dotenv'
import fs from 'node:fs/promises'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildReport } from './chapters'
import { loadChapterFigures, loadLines } from './data'
import { parseCbpPdf } from '../trq'

// Opt-in only. Uses the existing local trade history without Payload init,
// schema push, imports, uploads, emails, or changes to global pg parsers.
describe.skipIf(process.env.TTB_INTEGRATION !== '1')('trade report against local Postgres', () => {
  let client: pg.Client

  beforeAll(async () => {
    dotenv.config()
    const connectionString = process.env.DATABASE_URI
    if (!connectionString || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname)) {
      throw new Error('Trade integration tests require a local DATABASE_URI')
    }
    client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 })
    await client.connect()
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
  })

  afterAll(async () => {
    if (client) {
      try { await client.query('ROLLBACK') } finally { await client.end() }
    }
  })

  it('agrees with an independent SQL aggregate for real August 2026 leaf exports', async () => {
    const lines = (await loadLines(client)).get('EXPORT_LEAF')!
    const target = lines.find((l) => l.description === 'Flue-Cured Tobacco Unstemmed and Stemmed')!
    expect(target).toBeDefined()
    const [actual] = await loadChapterFigures(client, [target], 'export', 2026, 8)
    const { rows: [expected] } = await client.query(
      `select sum(f.all_qy1_yr)::text as quantity, sum(f.all_val_yr)::text as value
         from trade.export_fact f
        where f.yr = 2026 and f.mo = 8 and f.dom_or_for = 1
          and exists (select 1 from report.line_member m where m.hts = f.hts and m.line_id = $1
            and (m.valid_from is null or m.valid_from <= date '2026-08-01')
            and (m.valid_to is null or m.valid_to >= date '2026-08-01'))`, [target.lineId],
    )
    expect(expected.quantity).not.toBeNull()
    expect(actual.total.qtyYtd).toBe(Number(expected.quantity))
    expect(actual.total.valYtd).toBe(Number(expected.value))
    expect(actual.countries.reduce((sum, c) => sum + c.qtyYtd, 0)).toBe(actual.total.qtyYtd)
  })

  it('builds all six chapters without invalid figures or malformed tables', async () => {
    const report = await buildReport(client, 2026, 8, { trq: await parseCbpPdf(await fs.readFile('src/lib/ttb/fixtures/cbp-2026-10-13.pdf'), '2026-10-13'), usTrade: {
      exports: { month: 315.182, prevMonth: 310.723, ytd: 2400, prevYtd: 2300, priorThreeMonthAverage: 316.012 },
      imports: { month: 420.754, prevMonth: 403.55, ytd: 3000, prevYtd: 3100, priorThreeMonthAverage: 395.93 },
      source: { period: '2026-08', retrievedAt: '2026-10-15T00:00:00Z', series: ['BOPTEXP', 'BOPTIMP', 'BOPGSTB'] },
    } }, new Date('2026-10-16T02:00:00Z'))
    const firstBlocks = report.chapters[0].sections[0].blocks
    expect(firstBlocks.some(b => b.kind === 'para' && b.text.includes('goods and services trade'))).toBe(true)
    const balances = firstBlocks.find(b => b.kind === 'table' && b.table.title === 'Total US and Tobacco Industry Balance of Trade')
    expect(balances?.kind === 'table' && balances.table.rows.some(r => r.cells[0].text === 'Imports [BOP basis]')).toBe(true)
    const trq = firstBlocks.find(b => b.kind === 'table' && b.table.header[0].cells[1].text === 'Cigarette Leaf Imported')
    expect(trq?.kind === 'table' && trq.table.rows).toHaveLength(12) // 11 quota rows plus total
    expect(trq?.kind === 'table' && trq.table.header[0].cells[2].text).toBe('2026/2027 Quota Level')
    expect(firstBlocks.some(b => b.kind === 'para' && b.text.includes('26_1013_commodity_status_report.pdf'))).toBe(true)
    expect(report.chapters).toHaveLength(6)
    for (const chapter of report.chapters) {
      const releases = chapter.sections.flatMap(s => s.blocks).filter(b => b.kind === 'para' && b.text.startsWith('Released '))
      expect(releases).toEqual([{ kind: 'para', text: 'Released October 15, 2026', italic: true }])
    }
    const paragraphs = report.chapters.flatMap(c => c.sections.flatMap(s => s.blocks.filter(b => b.kind === 'para').map(b => b.text))).join(' ')
    expect(paragraphs).not.toMatch(/\[\[|\]\]|Lead-in|Keep only GSP/)
    expect(paragraphs).toContain('The U.S. tobacco industry in August 2026')
    expect(paragraphs.match(/recorded as duty-free under special provisions/g)).toHaveLength(2)
    let tables = 0
    for (const chapter of report.chapters) for (const section of chapter.sections) for (const block of section.blocks) {
      if (block.kind === 'para' || block.kind === 'heading') expect(block.text).not.toMatch(/\b(?:NaN|Infinity)\b/)
      if (block.kind !== 'table') continue
      tables++
      for (const row of [...block.table.header, ...block.table.rows]) {
        expect(row.cells).toHaveLength(block.table.widths.length)
        for (const cell of row.cells) {
          expect(cell.text).not.toMatch(/\b(?:NaN|Infinity)\b/)
          // No trade figure in this fixture can legitimately contain >16 digits.
          expect(cell.text.replace(/[$,.+\-]/g, '')).not.toMatch(/\d{17}/)
        }
      }
    }
    expect(tables).toBeGreaterThan(100)
  }, 20000)

  it('blocks first-time restore instructions when trade schemas already exist', async () => {
    const sql = await fs.readFile('migration/ttb/preflight.sql', 'utf8')
    await client.query('SAVEPOINT restore_guard')
    try {
      await expect(client.query(sql)).rejects.toThrow(/Trade schemas already exist/)
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT restore_guard')
    }
  })
})
