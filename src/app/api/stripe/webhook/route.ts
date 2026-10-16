import { getPayload } from 'payload'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import config from '@/payload.config'
import { getStripeClient } from '@/lib/stripe'
import { handleStripeSession } from '@/lib/stripeFulfillment'
import { allowLocalWebhookSimulation } from '@/lib/localSafety'

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      const stripe = getStripeClient()
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature || '',
        process.env.STRIPE_WEBHOOK_SECRET,
      )
    } else if (allowLocalWebhookSimulation(request)) {
      // Dev convenience only: no webhook secret configured, so signature isn't checked.
      event = JSON.parse(rawBody) as Stripe.Event
    } else {
      return NextResponse.json(
        { error: 'Stripe webhook verification is not configured.' },
        { status: 503 },
      )
    }
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (
    [
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.expired',
    ].includes(event.type)
  ) {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.id) {
      if (event.livemode !== (process.env.STRIPE_MODE === 'live'))
        return NextResponse.json({ error: 'Stripe event mode mismatch.' }, { status: 400 })
      try {
        const payloadConfig = await config
        const payload = await getPayload({ config: payloadConfig })
        await handleStripeSession(payload, session.id)
      } catch (error) {
        console.error('Stripe fulfillment failed', error)
        return NextResponse.json(
          { error: 'Fulfillment did not complete; retry this event.' },
          { status: 500 },
        )
      }
    }
  }

  return NextResponse.json({ received: true })
}
