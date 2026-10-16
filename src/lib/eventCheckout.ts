import type { Payload, PayloadRequest, Where } from 'payload'

import type { DiscountCode, Event } from '@/payload-types'

type TicketType = NonNullable<Event['ticketTypes']>[number]

export function findTicketType(event: Event, ticketTypeName: string): TicketType | undefined {
  return event.ticketTypes?.find((t) => t.name === ticketTypeName)
}

/** Null means that attendance mode isn't offered for this ticket type (e.g. no virtual option). */
export function ticketUnitPrice(
  ticketType: TicketType,
  attendance: 'in-person' | 'virtual',
  isSubscriber: boolean,
): number | null {
  const bucket = attendance === 'in-person' ? ticketType.inPerson : ticketType.virtual
  if (!bucket || bucket.price == null) return null
  const price = isSubscriber ? (bucket.subscriberPrice ?? bucket.price) : bucket.price
  return price
}

export type DiscountValidation = { discount: DiscountCode } | { error: string }

/** Validates a code against this event/ticket type and checks remaining uses for the requested quantity. */
export async function validateDiscountCode(
  payload: Payload,
  code: string,
  event: Event,
  ticketTypeName: string,
  quantity: number,
  req?: PayloadRequest,
): Promise<DiscountValidation> {
  const { docs } = await payload.find({
    collection: 'discount-codes',
    where: { code: { equals: code } },
    limit: 1,
    overrideAccess: true,
    req,
  })
  const discount = docs[0]
  if (!discount) return { error: 'Invalid discount code.' }

  const discountEventId = typeof discount.event === 'object' ? discount.event.id : discount.event
  if (discountEventId !== event.id) return { error: 'This code is not valid for this event.' }

  if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
    return { error: 'This code has expired.' }
  }

  if (
    discount.ticketTypes?.length &&
    !discount.ticketTypes.some((t) => t.name === ticketTypeName)
  ) {
    return { error: 'This code does not apply to the selected ticket type.' }
  }

  const { totalDocs: usesSoFar } = await payload.find({
    collection: 'event-registrations',
    where: { and: [{ discountCode: { equals: discount.id } }, reservedTicketWhere()] },
    limit: 0,
    overrideAccess: true,
    req,
  })
  if (usesSoFar + quantity > discount.maxUses) {
    return { error: `This code only has ${Math.max(discount.maxUses - usesSoFar, 0)} use(s) left.` }
  }

  return { discount }
}

export type PricedAttendee = { name: string; email: string; unitPrice: number }

export function reservedTicketWhere(): Where {
  return {
    or: [
      { and: [{ status: { equals: 'active' } }, { 'order.status': { equals: 'paid' } }] },
      {
        and: [
          { status: { equals: 'pending' as const } },
          { 'order.status': { equals: 'pending' } },
          { 'order.checkoutExpiresAt': { greater_than: new Date().toISOString() } },
        ],
      },
    ],
  }
}

/** Distribute cents without charging a rounded per-ticket price times quantity. */
export function allocateTicketCents(total: number, count: number): number[] {
  const cents = Math.round(total * 100)
  if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(count) || count < 1)
    throw new Error('Invalid ticket pricing.')
  return Array.from(
    { length: count },
    (_, index) => Math.floor(cents / count) + (index < cents % count ? 1 : 0),
  )
}

export type OrderPricing = {
  unitPrice: number
  subtotal: number
  discountAmount: number
  total: number
  priceBasis: 'standard' | 'subscriber'
}

export function priceOrder({
  unitPrice,
  attendeeCount,
  discount,
}: {
  unitPrice: number
  attendeeCount: number
  discount: DiscountCode | null
  priceBasis: 'standard' | 'subscriber'
}): Omit<OrderPricing, 'priceBasis'> {
  const unitCents = Math.round(unitPrice * 100)
  const subtotalCents = unitCents * attendeeCount
  if (!Number.isSafeInteger(subtotalCents) || unitCents < 0 || attendeeCount < 1)
    throw new Error('Invalid ticket pricing.')
  const discountCents = discount ? Math.round((subtotalCents * discount.percentOff) / 100) : 0
  return {
    unitPrice: unitCents / 100,
    subtotal: subtotalCents / 100,
    discountAmount: discountCents / 100,
    total: Math.max(subtotalCents - discountCents, 0) / 100,
  }
}
