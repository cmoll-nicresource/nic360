/**
 * Applies the old site's Mailchimp subscriber/interest data onto real
 * migrated Users' `emailPublications` — the one-time use of that pulled
 * data confirmed earlier (migration/pullMailchimpSubscribers.ts): Mailchimp
 * is not an ongoing sender, only ever the source of truth for who actually
 * opted into which newsletter, since the old site synced preferences
 * straight to Mailchimp rather than storing them itself.
 *
 * Only `status: 'subscribed'` members count (cleaned/unsubscribed/pending
 * are not real active preferences). Only the 10 interests matching a real
 * Publication here are applied — the other 14 (Trade Barometer variants,
 * China Watch, FDA Watch, Special Reports, Issues Monitor, etc.) were
 * already confirmed out of scope ("stick to 10").
 *
 * Usage: npx tsx migration/applyMailchimpPreferences.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '../src/payload.config'

const DATA_PATH = path.join(process.cwd(), 'migration', 'data', 'mailchimp-members.json')

// Mailchimp interest id -> this Publication's slug. Matched by exact name
// against the 10 real Publications already in the system; the other 14
// Mailchimp interests have no corresponding Publication and are skipped.
const INTEREST_TO_PUBLICATION_SLUG: Record<string, string> = {
  '9fa23f5edf': 'daily-executive-summary',
  '320c2adc9a': 'weekly-executive-summary',
  e06afb3d4e: 'global-news-clippings',
  b3403a93d3: 'us-news-clippings',
  c49834f3b9: 'vapor-news-clippings',
  '2d94cc610a': 'daily-us-legislative-snapshot',
  '8b0c56fdde': 'weekly-us-legislative-report',
  '0051e4c508': 'weekly-us-trademark-report',
  b1b76da5d1: 'monthly-us-trademark-activity',
  '0e3a2b2943': 'monthly-research-digest',
}

type MailchimpMember = {
  email_address: string
  status: string
  interests?: Record<string, boolean>
}

async function main() {
  const { members } = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')) as { members: MailchimpMember[] }
  const subscribed = members.filter((m) => m.status === 'subscribed')
  console.log(`${members.length} total Mailchimp members, ${subscribed.length} currently subscribed`)

  const payload = await getPayload({ config })

  console.log('Resolving Publication ids by slug...')
  const publicationIdBySlug = new Map<string, string | number>()
  for (const d of (await payload.find({ collection: 'publications', limit: 100, overrideAccess: true })).docs) {
    publicationIdBySlug.set(d.slug, d.id)
  }
  for (const slug of Object.values(INTEREST_TO_PUBLICATION_SLUG)) {
    if (!publicationIdBySlug.has(slug)) console.warn(`  WARNING: no Publication found for slug "${slug}"`)
  }

  let matched = 0
  let noPreferences = 0
  let notFound = 0

  for (const member of subscribed) {
    const email = member.email_address.toLowerCase().trim()
    const publicationIds = Object.entries(member.interests ?? {})
      .filter(([, on]) => on)
      .map(([interestId]) => INTEREST_TO_PUBLICATION_SLUG[interestId])
      .filter((slug): slug is string => Boolean(slug))
      .map((slug) => publicationIdBySlug.get(slug))
      .filter((id): id is string | number => id !== undefined)

    if (publicationIds.length === 0) {
      noPreferences++
      continue
    }

    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length === 0) {
      notFound++
      continue
    }

    await payload.update({
      collection: 'users',
      id: existing.docs[0].id,
      data: { emailPublications: publicationIds },
      overrideAccess: true,
    })
    matched++
  }

  console.log(`\nDone. ${matched} real users updated, ${noPreferences} subscribed members had none of our 10 publications checked, ${notFound} subscribed members have no matching migrated User.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
