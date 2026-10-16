import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import {
  allocateTicketCents,
  findTicketType,
  priceOrder,
  reservedTicketWhere,
  ticketUnitPrice,
  validateDiscountCode,
} from './eventCheckout'
import { inPayloadTransaction, transactionDb } from './payloadTransaction'
import { getStripeClient } from './stripe'
import { SITE_URL } from './env'
import { markOrderPaid } from './orderFulfillment'

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export function checkoutInput(value: unknown) {
  const body = value as {
    ticketTypeName?: unknown
    attendance?: unknown
    attendees?: unknown
    discountCode?: unknown
  }
  if (
    !body ||
    typeof body.ticketTypeName !== 'string' ||
    !['in-person', 'virtual'].includes(String(body.attendance))
  )
    throw new CheckoutError('Select a ticket type and attendance mode.')
  if (!Array.isArray(body.attendees) || !body.attendees.length || body.attendees.length > 50)
    throw new CheckoutError('Provide between 1 and 50 attendees.')
  const attendees = body.attendees.map((value) => {
    const row = value as { name?: unknown; email?: unknown }
    if (
      !row ||
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      row.name.length > 200 ||
      typeof row.email !== 'string' ||
      row.email.length > 254 ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(row.email.trim())
    )
      throw new CheckoutError('Each attendee needs a name and valid email address.')
    return { name: row.name.trim(), email: row.email.trim().toLowerCase() }
  })
  if (new Set(attendees.map((row) => row.email)).size !== attendees.length)
    throw new CheckoutError('List each attendee email only once.')
  if (body.discountCode != null && typeof body.discountCode !== 'string')
    throw new CheckoutError('Invalid discount code.')
  return {
    ticketTypeName: body.ticketTypeName,
    attendance: body.attendance as 'in-person' | 'virtual',
    attendees,
    discountCode: (body.discountCode as string | undefined)?.trim(),
  }
}

export async function createEventCheckout(
  payload: Payload,
  user: User,
  eventId: number,
  input: unknown,
) {
  if (!user._verified || user.status !== 'active')
    throw new CheckoutError('An active, verified account is required.', 403)
  const body = checkoutInput(input)
  if (!Number.isSafeInteger(eventId) || eventId <= 0)
    throw new CheckoutError('Event not found.', 404)
  const expiresAt = new Date(Date.now() + 35 * 60_000)
  const prepared = await inPayloadTransaction(payload, async (req) => {
    const tx = transactionDb(payload, await req.transactionID)
    await tx.execute(sql`SELECT id FROM events WHERE id=${eventId} FOR UPDATE`)
    const event = await payload
      .findByID({ collection: 'events', id: eventId, depth: 0, overrideAccess: true, req })
      .catch(() => null)
    if (!event) throw new CheckoutError('Event not found.', 404)
    const ticket = findTicketType(event, body.ticketTypeName)
    if (!ticket || ticket.onSale === false)
      throw new CheckoutError('That ticket type is not on sale.')
    if (ticket.capacity != null) {
      const used = await payload.count({
        collection: 'event-registrations',
        where: {
          and: [
            { event: { equals: event.id } },
            { ticketType: { equals: ticket.name } },
            reservedTicketWhere(),
          ],
        },
        overrideAccess: true,
        req,
      })
      if (used.totalDocs + body.attendees.length > ticket.capacity)
        throw new CheckoutError('Not enough tickets remaining for that ticket type.')
    }
    const subscriber = planSatisfies(await getReaderPlan(user, payload), 'base')
    const unitPrice = ticketUnitPrice(ticket, body.attendance, subscriber)
    if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice < 0)
      throw new CheckoutError('That attendance option is unavailable.')
    let discount = null
    if (body.discountCode) {
      const result = await validateDiscountCode(
        payload,
        body.discountCode,
        event,
        ticket.name,
        body.attendees.length,
        req,
      )
      if ('error' in result) throw new CheckoutError(result.error)
      discount = result.discount
    }
    const pricing = priceOrder({
      unitPrice,
      attendeeCount: body.attendees.length,
      discount,
      priceBasis: subscriber ? 'subscriber' : 'standard',
    })
    if (pricing.total > 0) {
      if (!process.env.STRIPE_WEBHOOK_SECRET)
        throw new CheckoutError('Payment setup is incomplete. Please contact staff.', 503)
      try {
        getStripeClient()
      } catch {
        throw new CheckoutError('Payment setup is incomplete. Please contact staff.', 503)
      }
    }
    const order = await payload.create({
      collection: 'orders',
      data: {
        buyer: user.id,
        event: event.id,
        discountCode: discount?.id,
        subtotal: pricing.subtotal,
        discount: pricing.discountAmount,
        total: pricing.total,
        status: 'pending',
        checkoutExpiresAt: expiresAt.toISOString(),
      },
      overrideAccess: true,
      req,
    })
    const cents = allocateTicketCents(pricing.total, body.attendees.length)
    for (const attendee of body.attendees) {
      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: attendee.email } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req,
      })
      await payload.create({
        collection: 'event-registrations',
        data: {
          order: order.id,
          event: event.id,
          attendee: existing.docs[0]?.id,
          attendeeName: attendee.name,
          attendeeEmail: attendee.email,
          ticketType: ticket.name,
          attendance: body.attendance,
          priceBasis: subscriber ? 'subscriber' : 'standard',
          amountPaid: 0,
          discountCode: discount?.id,
          status: 'pending',
        },
        overrideAccess: true,
        req,
      })
    }
    return { order, event, ticket, cents }
  })
  if (prepared.order.total === 0) {
    await markOrderPaid(payload, prepared.order.id, 'comped')
    return { checkoutUrl: null, orderId: prepared.order.id, comped: true }
  }
  const counts = new Map<number, number>()
  for (const cents of prepared.cents) counts.set(cents, (counts.get(cents) || 0) + 1)
  try {
    const session = await getStripeClient().checkout.sessions.create(
      {
        mode: 'payment',
        allowed_payment_method_types: ['card'],
        customer_email: user.email,
        line_items: [...counts].map(([cents, quantity]) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${prepared.event.name} — ${prepared.ticket.name} (${body.attendance})`,
            },
            unit_amount: cents,
          },
          quantity,
        })),
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        success_url: `${SITE_URL}/events/${eventId}/success?order=${prepared.order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/events/${eventId}?cancelled=1`,
        metadata: { orderId: String(prepared.order.id), nic360: 'events' },
      },
      { idempotencyKey: `event-order-${prepared.order.id}` },
    )
    await payload.update({
      collection: 'orders',
      id: prepared.order.id,
      data: { stripeSessionId: session.id },
      overrideAccess: true,
    })
    return { checkoutUrl: session.url, orderId: prepared.order.id }
  } catch (error) {
    // Retain uncertain outcomes until expiry; never silently create another session.
    await payload.update({
      collection: 'orders',
      id: prepared.order.id,
      data: {
        fulfillmentError:
          'Checkout session creation did not finish. Review Stripe before retrying; this reservation expires automatically.',
      },
      overrideAccess: true,
    })
    throw error
  }
}
