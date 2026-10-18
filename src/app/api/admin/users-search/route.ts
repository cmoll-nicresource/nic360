import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { buildUserSearchWhere } from '@/lib/userSearch'

/** Backs the Analytics dashboard's "By user" search — there are 1000+ users, too many for a plain dropdown. */
export async function GET(request: Request) {
  try {
    const { payload } = await requireStaff('gatekeeper')

    const q = new URL(request.url).searchParams.get('q') ?? ''
    const where = buildUserSearchWhere(q)
    if (!where) return NextResponse.json({ users: [] })

    const { docs } = await payload.find({
      collection: 'users',
      where,
      limit: 20,
      sort: 'email',
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({
      users: docs.map((u) => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName })),
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 })
  }
}
