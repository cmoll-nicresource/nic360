import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { parseCsv, suggestMapping } from '@/lib/datasetImport'
import { putUpload } from '@/lib/importCache'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('editor')

    const dataset = await payload.findByID({ collection: 'datasets', id, overrideAccess: true }).catch(() => null)
    if (!dataset) return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 })

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parseCsv(buffer.toString('utf-8'))
    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: 'Could not find a header row in that file.' }, { status: 400 })
    }

    const token = putUpload(buffer, file.name)

    return NextResponse.json({
      token,
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 5),
      totalRows: parsed.rows.length,
      suggestedMapping: suggestMapping(parsed.headers, dataset.columns),
      columns: dataset.columns,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to parse file.' }, { status: 500 })
  }
}
