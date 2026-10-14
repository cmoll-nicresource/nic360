import { NextResponse } from 'next/server'

import { buildCountryNameLookup, resolveCountryColumns } from '@/lib/countryLookup'
import { requireReaderPlan } from '@/lib/requireReaderPlan'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireReaderPlan('premium')

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

    const nameByIso2 = buildCountryNameLookup(countries)
    const rows = resolveCountryColumns(dataset.columns, docs.map((d) => d.values as Record<string, unknown>), nameByIso2)

    return NextResponse.json({
      columns: dataset.columns,
      rows,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to load rows.' }, { status: 500 })
  }
}
