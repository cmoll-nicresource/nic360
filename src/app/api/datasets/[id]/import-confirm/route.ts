import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { commitImport, parseCsv } from '@/lib/datasetImport'
import { dropUpload, getUpload } from '@/lib/importCache'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('editor')

    const dataset = await payload.findByID({ collection: 'datasets', id, overrideAccess: true }).catch(() => null)
    if (!dataset) return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 })

    const body = (await request.json()) as {
      token: string
      mapping: Record<string, string | null>
      replace: boolean
    }

    const upload = getUpload(body.token)
    if (!upload) {
      return NextResponse.json(
        { error: 'That upload has expired. Please upload the file again.' },
        { status: 400 },
      )
    }

    const parsed = parseCsv(upload.buffer.toString('utf-8'))

    const media = await payload.create({
      collection: 'media',
      data: { alt: `${dataset.title} import — ${upload.filename}` },
      // CSV has no magic-byte signature for Payload's file-type sniffing to
      // detect, so pass the mimetype explicitly rather than via filePath.
      file: { data: upload.buffer, mimetype: 'text/csv', name: upload.filename, size: upload.buffer.length },
      overrideAccess: true,
    })

    const result = await commitImport({
      payload,
      dataset,
      parsed,
      mapping: body.mapping,
      replace: body.replace,
      fileId: media.id,
    })

    dropUpload(body.token)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to import file.' }, { status: 500 })
  }
}
