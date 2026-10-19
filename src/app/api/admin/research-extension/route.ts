import fs from 'node:fs/promises'
import path from 'node:path'
import { requireStaff } from '@/lib/requireStaff'
export async function GET() {
  try {
    await requireStaff('editor')
    const bytes = await fs.readFile(
      path.join(process.cwd(), 'assets/extensions/nic360-research-clipper.zip'),
    )
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': 'application/zip',
        'content-disposition':
          'attachment; filename="nic360-research-clipper.zip"',
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json(
      { error: 'The Research Clipper download is unavailable.' },
      { status: 503 },
    )
  }
}
