import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getStripeClient } from './stripe'
import { markOrderPaid } from './orderFulfillment'
import { inPayloadTransaction, transactionDb } from './payloadTransaction'

export async function handleStripeSession(payload: Payload, sessionId: string) {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId)
  if (session.metadata?.nic360 !== 'events') return
  if (session.livemode !== (process.env.STRIPE_MODE === 'live'))
    throw new Error('Stripe session mode mismatch.')
  const orderId = Number(session.metadata?.orderId)
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return
  const order = await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
    overrideAccess: true,
  })
  if (
    order.stripeSessionId !== session.id ||
    session.mode !== 'payment' ||
    session.currency !== 'usd' ||
    session.amount_total !== Math.round(order.total * 100)
  )
    throw new Error('Stripe session does not match the stored order.')
  if (session.status === 'expired') {
    await inPayloadTransaction(payload, async (req) => {
      await transactionDb(payload, await req.transactionID).execute(
        sql`SELECT id FROM orders WHERE id=${orderId} FOR UPDATE`,
      )
      const fresh = await payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 0,
        req,
        overrideAccess: true,
      })
      if (fresh.status !== 'pending') return
      await payload.update({
        collection: 'orders',
        id: orderId,
        data: { status: 'cancelled' },
        req,
        overrideAccess: true,
      })
      await payload.update({
        collection: 'event-registrations',
        where: { order: { equals: orderId } },
        data: { status: 'cancelled' },
        req,
        overrideAccess: true,
      })
    })
    return
  }
  if (session.status !== 'complete' || session.payment_status !== 'paid') return
  const payment = session.payment_intent as Stripe.PaymentIntent | string | null
  try {
    await markOrderPaid(
      payload,
      orderId,
      typeof payment === 'string' ? payment : payment?.id || session.id,
    )
  } catch (error) {
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        fulfillmentError:
          'Stripe payment verified, but ticket activation failed. Review capacity, discount allocation and app logs before retrying this event.',
      },
      overrideAccess: true,
    })
    throw error
  }
}
