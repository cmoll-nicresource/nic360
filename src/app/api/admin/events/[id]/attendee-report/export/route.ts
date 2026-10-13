import Papa from 'papaparse'
import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { getAttendeeReport } from '@/lib/eventAnalytics'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('gatekeeper')

    const event = await payload.findByID({ collection: 'events', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    const rows = await getAttendeeReport(payload, event.id)

    const csv = Papa.unparse({
      fields: [
        'Name',
        'Email',
        'Ticket type',
        'Attendance',
        'Status',
        'Paid',
        'Discount code',
        'Est. sessions attended (livestream ping match)',
        'Est. total livestream minutes',
      ],
      data: rows.map((r) => [
        r.attendeeName,
        r.attendeeEmail,
        r.ticketType,
        r.attendance,
        r.status,
        r.amountPaid.toFixed(2),
        r.discountCode ?? '',
        r.sessionsAttended.map((s) => `${s.sessionTitle} (~${s.estimatedMinutes}m)`).join('; '),
        r.estimatedTotalMinutes,
      ]),
    })

    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${event.name.replace(/[^\w.-]+/g, '-')}-attendees.csv"`,
      },
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to export attendee report.' }, { status: 500 })
  }
}
