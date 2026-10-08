import Papa from 'papaparse'
import { NextResponse } from 'next/server'

import { requireReaderPlan } from '@/lib/requireReaderPlan'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireReaderPlan('premium')

    const dataset = await payload.findByID({ collection: 'datasets', id, overrideAccess: true }).catch(() => null)
    if (!dataset) return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 })

    const { docs } = await payload.find({
      collection: 'dataset-rows',
      where: { dataset: { equals: dataset.id } },
      limit: 10000,
      depth: 0,
      overrideAccess: true,
    })

    const columns = dataset.columns
    const csv = Papa.unparse({
      fields: columns.map((c) => c.label),
      data: docs.map((d) => columns.map((c) => (d.values as Record<string, unknown>)[c.key ?? ''] ?? '')),
    })

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
