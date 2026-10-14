import Papa from 'papaparse'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { buildCountryNameLookup, resolveCountryColumns } from '@/lib/countryLookup'
import { requireReaderPlan } from '@/lib/requireReaderPlan'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireReaderPlan('premium')
    const format = new URL(request.url).searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'

    const dataset = await payload.findByID({ collection: 'datasets', id, overrideAccess: true }).catch(() => null)
    if (!dataset) return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 })

    const [{ docs }, { docs: countries }] = await Promise.all([
      payload.find({
        collection: 'dataset-rows',
        where: { dataset: { equals: dataset.id } },
        limit: 10000,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({ collection: 'countries', limit: 1000, depth: 0, overrideAccess: true }),
    ])

    const columns = dataset.columns
    const nameByIso2 = buildCountryNameLookup(countries)
    const resolved = resolveCountryColumns(columns, docs.map((d) => d.values as Record<string, unknown>), nameByIso2)
    const rows = resolved.map((values) => columns.map((c) => values[c.key ?? ''] ?? ''))

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.aoa_to_sheet([columns.map((c) => c.label), ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

      return new NextResponse(buffer, {
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': `attachment; filename="${dataset.slug}.xlsx"`,
        },
      })
    }

    const csv = Papa.unparse({ fields: columns.map((c) => c.label), data: rows })
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${dataset.slug}.csv"`,
      },
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to export dataset.' }, { status: 500 })
  }
}
