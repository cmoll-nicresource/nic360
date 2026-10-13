import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'
import { incrementAdClicks } from '@/lib/adStats'
import { SITE_URL } from '@/lib/env'

/**
 * The click-through URL embedded in every rendered ad (see `renderAdHtml` in
 * `src/lib/issueEmail.ts`) — routes through here instead of linking straight
 * to the advertiser so we can count the click ourselves. Public: whoever
 * clicks an ad in an email or on the web isn't necessarily signed in.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config: await config })

  const ad = await payload.findByID({ collection: 'publication-ads', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!ad?.link) {
    return NextResponse.redirect(SITE_URL)
  }

  await incrementAdClicks(payload, ad.id).catch((err) => console.error('Failed to record ad click', err))

  return NextResponse.redirect(ad.link)
}
