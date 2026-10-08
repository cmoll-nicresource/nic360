import { NextResponse } from 'next/server'

import { requireReader } from '@/lib/requireReader'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { findTicketType, priceOrder, ticketUnitPrice, validateDiscountCode } from '@/lib/eventCheckout'
import { getStripeClient } from '@/lib/stripe'
import { SITE_URL } from '@/lib/env'

type CheckoutBody = {
  ticketTypeName: string
  attendance: 'in-person' | 'virtual'
  attendees: Array<{ name: string; email: string }>
  discountCode?: string
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload, user } = await requireReader()
    const body = (await request.json()) as CheckoutBody

    if (!body.attendees?.length) {
      return NextResponse.json({ error: 'At least one attendee is required.' }, { status: 400 })
    }

    const event = await payload.findByID({ collection: 'events', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    const ticketType = findTicketType(event, body.ticketTypeName)
    if (!ticketType || ticketType.onSale === false) {
      return NextResponse.json({ error: 'That ticket type is not on sale.' }, { status: 400 })
    }

    if (ticketType.capacity != null) {
      const { totalDocs: used } = await payload.find({
        collection: 'event-registrations',
        where: {
          and: [
            { event: { equals: event.id } },
            { ticketType: { equals: ticketType.name } },
            { status: { equals: 'active' } },
          ],
        },
        limit: 0,
        overrideAccess: true,
      })
      if (used + body.attendees.length > ticketType.capacity) {
        return NextResponse.json({ error: 'Not enough tickets remaining for that ticket type.' }, { status: 400 })
      }
    }

    const plan = await getReaderPlan(user, payload)
    const isSubscriber = planSatisfies(plan, 'base')
    const priceBasis = isSubscriber ? 'subscriber' : 'standard'

    const unitPrice = ticketUnitPrice(ticketType, body.attendance, isSubscriber)
    if (unitPrice == null) {
      return NextResponse.json({ error: `No ${body.attendance} option for that ticket type.` }, { status: 400 })
    }

    let discount = null
    if (body.discountCode) {
      const result = await validateDiscountCode(payload, body.discountCode, event, ticketType.name, body.attendees.length)
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
      discount = result.discount
    }

    const pricing = priceOrder({ unitPrice, attendeeCount: body.attendees.length, discount, priceBasis })

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
      },
      overrideAccess: true,
    })

    const perTicketAmount = Math.round((pricing.total / body.attendees.length) * 100) / 100

    for (const attendee of body.attendees) {
      const { docs: existingUsers } = await payload.find({
        collection: 'users',
        where: { email: { equals: attendee.email.toLowerCase() } },
        limit: 1,
        overrideAccess: true,
      })

      await payload.create({
        collection: 'event-registrations',
        data: {
          order: order.id,
          event: event.id,
          attendee: existingUsers[0]?.id,
          attendeeName: attendee.name,
          attendeeEmail: attendee.email.toLowerCase(),
          ticketType: ticketType.name,
          attendance: body.attendance,
          priceBasis,
          amountPaid: perTicketAmount,
          discountCode: discount?.id,
          status: 'active',
        },
        overrideAccess: true,
      })
    }

    // Comped (100%-off) tickets need no payment at all — mark paid immediately and skip Stripe.
    if (pricing.total === 0) {
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: { status: 'paid', paidAt: new Date().toISOString(), paymentRef: 'comped' },
        overrideAccess: true,
      })
      return NextResponse.json({ checkoutUrl: null, orderId: order.id, comped: true })
    }

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `${event.name} — ${ticketType.name} (${body.attendance})` },
            unit_amount: Math.round(perTicketAmount * 100),
          },
          quantity: body.attendees.length,
        },
      ],
      success_url: `${SITE_URL}/events/${event.id}/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/events/${event.id}?cancelled=1`,
      metadata: { orderId: String(order.id) },
    })

    return NextResponse.json({ checkoutUrl: session.url, orderId: order.id })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Checkout failed.' }, { status: 500 })
  }
}
