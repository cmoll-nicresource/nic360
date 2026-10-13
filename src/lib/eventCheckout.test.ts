import { describe, expect, it } from 'vitest'

import { findTicketType, priceOrder, ticketUnitPrice } from './eventCheckout'
import type { DiscountCode, Event } from '@/payload-types'

const generalAdmission = {
  name: 'General Admission',
  onSale: true,
  capacity: 200,
  inPerson: { price: 1200, subscriberPrice: 900 },
  virtual: { price: 400, subscriberPrice: 300 },
}

const virtualOnly = {
  name: 'Webinar Access',
  onSale: true,
  virtual: { price: 0 },
}

const event = {
  ticketTypes: [generalAdmission, virtualOnly],
} as unknown as Event

describe('findTicketType', () => {
  it('finds a ticket type by name', () => {
    expect(findTicketType(event, 'General Admission')?.name).toBe('General Admission')
  })

  it('returns undefined for an unknown ticket type name', () => {
    expect(findTicketType(event, 'VIP')).toBeUndefined()
  })
})

describe('ticketUnitPrice', () => {
  it('charges the standard price for a non-subscriber', () => {
    expect(ticketUnitPrice(generalAdmission, 'in-person', false)).toBe(1200)
    expect(ticketUnitPrice(generalAdmission, 'virtual', false)).toBe(400)
  })

  it('charges the subscriber price for a subscriber', () => {
    expect(ticketUnitPrice(generalAdmission, 'in-person', true)).toBe(900)
    expect(ticketUnitPrice(generalAdmission, 'virtual', true)).toBe(300)
  })

  it('falls back to the standard price when no subscriber price is set', () => {
    const noSubscriberPrice = { name: 'Academia', inPerson: { price: 300 }, virtual: { price: 100 } }
    expect(ticketUnitPrice(noSubscriberPrice, 'in-person', true)).toBe(300)
  })

  it('returns null when an attendance mode is not offered (e.g. no in-person option)', () => {
    expect(ticketUnitPrice(virtualOnly, 'in-person', false)).toBeNull()
  })

  it('treats a $0 price as valid, not "not offered"', () => {
    expect(ticketUnitPrice(virtualOnly, 'virtual', false)).toBe(0)
  })
})

describe('priceOrder', () => {
  it('prices a single attendee with no discount', () => {
    const pricing = priceOrder({ unitPrice: 1200, attendeeCount: 1, discount: null, priceBasis: 'standard' })
    expect(pricing).toEqual({ unitPrice: 1200, subtotal: 1200, discountAmount: 0, total: 1200 })
  })

  it('multiplies by attendee count', () => {
    const pricing = priceOrder({ unitPrice: 900, attendeeCount: 3, discount: null, priceBasis: 'subscriber' })
    expect(pricing.subtotal).toBe(2700)
    expect(pricing.total).toBe(2700)
  })

  it('applies a percent-off discount to the subtotal', () => {
    const discount = { percentOff: 25 } as DiscountCode
    const pricing = priceOrder({ unitPrice: 1000, attendeeCount: 2, discount, priceBasis: 'standard' })
    expect(pricing.subtotal).toBe(2000)
    expect(pricing.discountAmount).toBe(500)
    expect(pricing.total).toBe(1500)
  })

  it('a 100% discount comps the order to zero, never negative', () => {
    const discount = { percentOff: 100 } as DiscountCode
    const pricing = priceOrder({ unitPrice: 1200, attendeeCount: 1, discount, priceBasis: 'standard' })
    expect(pricing.total).toBe(0)
  })

  it('rounds the discount amount to the nearest cent', () => {
    const discount = { percentOff: 33 } as DiscountCode
    const pricing = priceOrder({ unitPrice: 100, attendeeCount: 1, discount, priceBasis: 'standard' })
    expect(pricing.discountAmount).toBe(33)
    expect(pricing.total).toBe(67)
  })
})
