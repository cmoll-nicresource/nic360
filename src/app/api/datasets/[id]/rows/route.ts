import { NextResponse } from 'next/server'

import { buildCountryNameLookup, resolveCountryColumns } from '@/lib/countryLookup'
import { requireSubscriptionPlan } from '@/lib/requireSubscriptionPlan'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireSubscriptionPlan('premium')
    const rawPage = Number(new URL(request.url).searchParams.get('page') || 1)
    if (!Number.isSafeInteger(rawPage) || rawPage < 1)
      return NextResponse.json({ error: 'Invalid page.' }, { status: 400 })

    const dataset = await payload
      .findByID({ collection: 'datasets', id, overrideAccess: true })
      .catch(() => null)
    if (!dataset) return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 })

    const [result, { docs: countries }] = await Promise.all([
      payload.find({
        collection: 'dataset-rows',
        where: { dataset: { equals: dataset.id } },
        limit: 2000,
        page: rawPage,
        sort: 'id',
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({ collection: 'countries', limit: 1000, depth: 0, overrideAccess: true }),
    ])

    const nameByIso2 = buildCountryNameLookup(countries)
    const rows = resolveCountryColumns(
      dataset.columns,
      result.docs.map((d) => d.values as Record<string, unknown>),
      nameByIso2,
    )

    return NextResponse.json({
      columns: dataset.columns,
      rows,
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
      page: result.page,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to load rows.' }, { status: 500 })
  }
}
