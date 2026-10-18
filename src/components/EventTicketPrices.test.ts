import { it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EventTicketPrices } from './EventTicketPrices'

it('advertises both rates and real savings, with a same-price fallback and no unavailable attendance options', () => {
  const html = renderToStaticMarkup(createElement(EventTicketPrices, { ticketTypes: [
    { name: 'General', onSale: false, honorSystem: true, inPerson: { price: 1200, subscriberPrice: 900 } },
    { name: 'Online', virtual: { price: 50 } },
    { name: 'Complimentary', virtual: { price: 0, subscriberPrice: 0 } },
  ] }))
  for (const text of ['Non-subscriber', 'Subscriber', '$1,200.00', '$900.00', 'Subscribers save $300.00 per ticket.', 'Online · Virtual', 'Free'])
    expect(html).toContain(text)
  expect(html.match(/\$50.00/g)).toHaveLength(2)
  expect(html).not.toContain('Online · In person')
  expect(html).not.toContain('self-declared')
  expect(html).not.toContain('save Free')
})
