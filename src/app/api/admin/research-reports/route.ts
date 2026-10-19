import { requireStaff } from '@/lib/requireStaff'
import { generateResearchDigest } from '@/lib/research/generate'
export async function POST(request: Request) {
  try {
    const { payload } = await requireStaff('editor')
    const input = await request.json()
    if (typeof input?.month !== 'string')
      return Response.json(
        { error: 'Select a research month.' },
        { status: 400 },
      )
    return Response.json(await generateResearchDigest(payload, input.month))
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Research digest generation failed.',
      },
      { status: 400 },
    )
  }
}
