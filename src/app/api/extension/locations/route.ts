import { getPayload } from 'payload'
import { NextResponse } from 'next/server'
import config from '@/payload.config'
import { staffHasRole } from '@/access/staffRoles'
import { authenticateClipper } from '@/lib/clipperAuth'
import { extensionCorsHeaders, extensionOptionsResponse } from '@/lib/extensionCors'
import { clipLocationCatalog } from '@/lib/extensionClip'
import type { Location } from '@/payload-types'

export const OPTIONS = extensionOptionsResponse
export async function GET(request: Request) {
  const cors = extensionCorsHeaders(request.headers.get('origin'))
  const payload = await getPayload({ config: await config })
  const user = await authenticateClipper(payload, request)
  if (!staffHasRole(user, 'editor'))
    return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401, headers: cors })
  const locations: Location[] = []
  let page = 1, more = true
  while (more) {
    const result = await payload.find({ collection: 'locations', depth: 0, limit: 500, page: page++, sort: 'name', user, overrideAccess: false })
    locations.push(...result.docs)
    more = result.hasNextPage
  }
  return NextResponse.json({ locations: clipLocationCatalog(locations) }, { headers: cors })
}
