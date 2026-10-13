/**
 * Pulls the full "Nicotine360 Publications" audience (list f85a4ca640) from
 * Mailchimp — every member's email, status, and per-interest subscription
 * flags — and writes the raw result to migration/data/mailchimp-members.json
 * (gitignored; never committed).
 *
 * GET requests only, deliberately — the API key in .env isn't scoped
 * read-only (Mailchimp doesn't support that), so this file must not call
 * any endpoint that could mutate the real account. Don't add POST/PUT/
 * PATCH/DELETE calls here.
 *
 * Usage: npx tsx migration/pullMailchimpSubscribers.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'

const LIST_ID = 'f85a4ca640'
const PAGE_SIZE = 1000
const OUT_DIR = path.join(process.cwd(), 'migration', 'data')
const OUT_FILE = path.join(OUT_DIR, 'mailchimp-members.json')

type MailchimpInterest = { id: string; name: string }
type MailchimpInterestCategory = { id: string; title: string }
type MailchimpMember = {
  id: string
  email_address: string
  status: string
  interests?: Record<string, boolean>
}

function mailchimpAuth(apiKey: string): string {
  return 'Basic ' + Buffer.from('anystring:' + apiKey).toString('base64')
}

async function mcGet<T>(base: string, auth: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: auth } })
  if (!res.ok) {
    throw new Error(`Mailchimp GET ${path} failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

async function main() {
  const apiKey = process.env.MAILCHIMP_API_KEY
  if (!apiKey) throw new Error('MAILCHIMP_API_KEY is not set in .env')
  const dc = apiKey.split('-').pop()
  const base = `https://${dc}.api.mailchimp.com/3.0`
  const auth = mailchimpAuth(apiKey)

  console.log('Fetching interest categories + interests (for human-readable labels)...')
  const { categories } = await mcGet<{ categories: MailchimpInterestCategory[] }>(
    base,
    auth,
    `/lists/${LIST_ID}/interest-categories?count=100`,
  )
  const interestNameById = new Map<string, string>()
  for (const cat of categories) {
    const { interests } = await mcGet<{ interests: MailchimpInterest[] }>(
      base,
      auth,
      `/lists/${LIST_ID}/interest-categories/${cat.id}/interests?count=200`,
    )
    for (const interest of interests) {
      interestNameById.set(interest.id, `${cat.title}: ${interest.name}`)
    }
  }
  console.log(`Found ${interestNameById.size} interests across ${categories.length} categories.`)

  console.log('Fetching all members (paginated)...')
  const members: MailchimpMember[] = []
  let offset = 0
  for (;;) {
    const { members: page } = await mcGet<{ members: MailchimpMember[] }>(
      base,
      auth,
      `/lists/${LIST_ID}/members?fields=members.id,members.email_address,members.status,members.interests&count=${PAGE_SIZE}&offset=${offset}`,
    )
    members.push(...page)
    console.log(`  fetched ${members.length} so far...`)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify({ listId: LIST_ID, pulledAt: new Date().toISOString(), interestNames: Object.fromEntries(interestNameById), members }, null, 2),
  )
  console.log(`\nWrote ${members.length} members to ${path.relative(process.cwd(), OUT_FILE)}`)

  // Summary stats — counts only, no emails printed.
  const byStatus = new Map<string, number>()
  for (const m of members) byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1)
  console.log('\nBy status:', Object.fromEntries(byStatus))

  const subscribed = members.filter((m) => m.status === 'subscribed')
  const byInterest = new Map<string, number>()
  for (const m of subscribed) {
    for (const [interestId, on] of Object.entries(m.interests ?? {})) {
      if (on) byInterest.set(interestId, (byInterest.get(interestId) ?? 0) + 1)
    }
  }
  console.log(`\nSubscribed members (${subscribed.length}) by interest:`)
  for (const [id, count] of [...byInterest.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}\t${interestNameById.get(id) ?? id}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
