import { requireUser } from '@/lib/requireUser'
import { CheckoutError, createEventCheckout } from '@/lib/createEventCheckout'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { payload, user } = await requireUser()
    const { id } = await params
    return Response.json(await createEventCheckout(payload, user, Number(id), await request.json()))
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof CheckoutError)
      return Response.json({ error: error.message }, { status: error.status })
    console.error('Event checkout failed', error)
    return Response.json(
      {
        error: 'Checkout failed. Please contact staff before retrying if payment may have started.',
      },
      { status: 500 },
    )
  }
}
