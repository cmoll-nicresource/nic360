import { NextResponse } from 'next/server'
import type { Payload } from 'payload'

import { requireStaff } from '@/lib/requireStaff'
import { previewMonthlyFile } from '@/lib/ttb/preview'
import { putUpload } from '@/lib/importCache'

async function previewOne(payload: Payload, file: File | null, year?: number) {
  if (!file) return null
  const buffer = Buffer.from(await file.arrayBuffer())
  const token = putUpload(buffer, file.name)
  const preview = await previewMonthlyFile(payload, file.name, buffer, year)
  return { token, fileName: file.name, preview }
}

export async function POST(request: Request) {
  try {
    const { payload } = await requireStaff('editor')
    const form = await request.formData()
    const importFile = form.get('importFile')
    const exportFile = form.get('exportFile')
    const yearRaw = form.get('year')
    const year = typeof yearRaw === 'string' && yearRaw.trim() ? Number(yearRaw) : undefined

    if (!(importFile instanceof File) && !(exportFile instanceof File)) {
      return NextResponse.json({ error: 'Upload at least one file.' }, { status: 400 })
    }

    const [importResult, exportResult] = await Promise.all([
      previewOne(payload, importFile instanceof File ? importFile : null, year),
      previewOne(payload, exportFile instanceof File ? exportFile : null, year),
    ])

    return NextResponse.json({ import: importResult, export: exportResult })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to preview the upload.' }, { status: 500 })
  }
}
