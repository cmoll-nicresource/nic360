import { getPayload } from 'payload'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import config from '@/payload.config'
import { getStripeClient } from '@/lib/stripe'
import { markOrderPaid } from '@/lib/orderFulfillment'

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      const stripe = getStripeClient()
      event = stripe.webhooks.constructEvent(rawBody, signature || '', process.env.STRIPE_WEBHOOK_SECRET)
    } else {
      // Dev convenience only: no webhook secret configured, so signature isn't checked.
      event = JSON.parse(rawBody) as Stripe.Event
    }
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId
    if (orderId) {
      const payloadConfig = await config
      const payload = await getPayload({ config: payloadConfig })
      const paymentRef =
        typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? session.id)
      await markOrderPaid(payload, Number(orderId), paymentRef)
    }
  }

  return NextResponse.json({ received: true })
}
