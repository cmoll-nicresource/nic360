import { NextResponse } from 'next/server'

import { dropUpload, getUpload } from '@/lib/importCache'
import { requireStaff } from '@/lib/requireStaff'
import type { Inputs } from '@/lib/ttb/report/chapters'
import { runTradeReportJob, type UploadedFile } from '@/lib/ttb/tradeReportJob'

export async function POST(request: Request) {
  try {
    const { payload } = await requireStaff('editor')
    const body = await request.json().catch(() => ({}))
    const importToken = typeof body?.importToken === 'string' ? body.importToken : undefined
    const exportToken = typeof body?.exportToken === 'string' ? body.exportToken : undefined
    const year = typeof body?.year === 'number' ? body.year : undefined
    const inputs: Inputs | undefined = body?.inputs && typeof body.inputs === 'object' ? body.inputs : undefined

    if (!importToken && !exportToken) {
      return NextResponse.json({ error: 'No upload to confirm — preview a file first.' }, { status: 400 })
    }

    const resolve = (token?: string): UploadedFile | undefined => {
      if (!token) return undefined
      const entry = getUpload(token)
      if (!entry) throw new Error('That upload has expired — preview the file again.')
      return { fileName: entry.filename, buffer: entry.buffer }
    }

    const importFile = resolve(importToken)
    const exportFile = resolve(exportToken)

    const result = await runTradeReportJob(payload, { importFile, exportFile, year, inputs, replaceExisting: true })

    if (importToken) dropUpload(importToken)
    if (exportToken) dropUpload(exportToken)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load the upload.' }, { status: 500 })
  }
}
