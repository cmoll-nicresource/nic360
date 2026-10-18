import Link from 'next/link'
import type { Event } from '@/payload-types'
import { ticketUnitPrice } from '@/lib/eventCheckout'

const money = (price: number) => price === 0 ? 'Free' : new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
}).format(price)

/** Public prices are visible before sign-in; checkout verifies subscription eligibility. */
export function EventTicketPrices({ ticketTypes }: { ticketTypes: NonNullable<Event['ticketTypes']> }) {
  if (!ticketTypes.length) return null
  return (
    <section className="event-ticket-prices" aria-label="Ticket prices">
      <h3>Ticket prices</h3>
      {ticketTypes.flatMap(ticket => (['in-person', 'virtual'] as const).map(attendance => {
        const standard = ticketUnitPrice(ticket, attendance, false)
        const subscriber = ticketUnitPrice(ticket, attendance, true)
        if (standard == null || subscriber == null) return null
        const savings = standard - subscriber
        return (
          <div className="event-ticket-prices__option" key={`${ticket.name}-${attendance}`}>
            <h4>{ticket.name} · {attendance === 'in-person' ? 'In person' : 'Virtual'}</h4>
            <dl>
              <div><dt>Non-subscriber</dt><dd>{money(standard)}</dd></div>
              <div className="event-ticket-prices__subscriber"><dt>Subscriber</dt><dd>{money(subscriber)}</dd></div>
            </dl>
            {savings > 0 && <p className="event-ticket-prices__savings">Subscribers save {money(savings)} per ticket.</p>}
          </div>
        )
      }))}
      <p className="edition-meta">Prices are per attendee in USD. Subscriber pricing is applied automatically for users with an active subscription through an access provider.</p>
      <Link href="/#membership">Explore subscription benefits ↗</Link>
    </section>
  )
}
