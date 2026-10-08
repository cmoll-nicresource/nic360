import type { Payload } from 'payload'

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
): Promise<DiscountValidation> {
  const { docs } = await payload.find({
    collection: 'discount-codes',
    where: { code: { equals: code } },
    limit: 1,
    overrideAccess: true,
  })
  const discount = docs[0]
  if (!discount) return { error: 'Invalid discount code.' }

  const discountEventId = typeof discount.event === 'object' ? discount.event.id : discount.event
  if (discountEventId !== event.id) return { error: 'This code is not valid for this event.' }

  if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
    return { error: 'This code has expired.' }
  }

  if (discount.ticketTypes?.length && !discount.ticketTypes.some((t) => t.name === ticketTypeName)) {
    return { error: 'This code does not apply to the selected ticket type.' }
  }

  const { totalDocs: usesSoFar } = await payload.find({
    collection: 'event-registrations',
    where: { and: [{ discountCode: { equals: discount.id } }, { status: { equals: 'active' } }] },
    limit: 0,
    overrideAccess: true,
  })
  if (usesSoFar + quantity > discount.maxUses) {
    return { error: `This code only has ${Math.max(discount.maxUses - usesSoFar, 0)} use(s) left.` }
  }

  return { discount }
}

export type PricedAttendee = { name: string; email: string; unitPrice: number }

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
  const subtotal = unitPrice * attendeeCount
  const discountAmount = discount ? Math.round(subtotal * (discount.percentOff / 100) * 100) / 100 : 0
  const total = Math.max(subtotal - discountAmount, 0)
  return { unitPrice, subtotal, discountAmount, total }
}
