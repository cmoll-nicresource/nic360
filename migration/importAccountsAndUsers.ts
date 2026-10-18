/**
 * Migrates the old site's `accounts` -> AccessProviders and `users` ->
 * Users (readers only; the 5 real staff accounts are handled separately by
 * importStaff.ts and are not touched here).
 *
 * Reads directly from the gzipped pg_dump at old-db/truecms.sql.gz (never
 * committed — see .gitignore). Decisions baked in here were confirmed by
 * hand against the real data, not guessed:
 *
 * ACCESS PROVIDERS — only 255 of the old site's 2,523 accounts have ever
 * been activated (non-null status) and aren't a "personal" (individual,
 * not company) account. Of those, 4 are internal/non-customer and are
 * excluded explicitly: the org's own account ("Nicotine Resource
 * Consortium", id 87 — allowedDomains nicotineresource.org + tma.org, the
 * org's current and legacy domains), "TrueGroup Agency" (21, the agency
 * that built the old site), and two test accounts ("NRC Test" 58, "Test
 * Company 1" 60). That leaves 251 real customer companies.
 *   status: Live -> live, Trial -> trial, Inactive/Pending -> pending
 *   plan: 'none' for every imported provider — only a handful should
 *     actually be Premium and staff will set those by hand afterward.
 *
 * USERS — of the 3,899 old users tied to those 251 accounts, the vast
 * majority (3,556) never once signed in (2,828 of those are "Invited" users
 * bulk-confirmed in a single batch on 2025-04-25 — a backend operation, not
 * real activity). Only two groups are migrated: anyone marked Active
 * (whether they ever signed in or not — confirmed deliberately, since
 * staff may have marked someone Active without them visiting yet), plus
 * the few Blocked users who did sign in at some point. No passwords are
 * migrated (the old bcrypt hashes aren't usable here); every imported user
 * gets a random throwaway password and must use "forgot password" to set
 * a real one.
 *
 * A handful of accounts tied to users under @nicotineresource.org,
 * @tma.org or @gtnftrust.org slipped into the candidate set as internal
 * staff/QA logins into real client accounts (e.g. a staffer added
 * themselves as a member of a client's account to help with support) —
 * excluded by domain, since none of them are real customers. Likewise all
 * 29 "dev+company@truegroup.agency" accounts are the build agency's own QA
 * logins into every client account, not real readers.
 *
 * A user tied to more than one of the 251 accounts (165 cases) is attached
 * to only one, per the "no multi-account fan-out" decision: whichever
 * account_users row has primary_user = true, else the earliest created.
 *
 * Usage: npx tsx migration/importAccountsAndUsers.ts
 */
import 'dotenv/config'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import zlib from 'zlib'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { latestLegacyLogin } from '../src/lib/legacyUserLogins'

const DUMP_PATH = path.join(process.cwd(), 'old-db', 'truecms.sql.gz')
const OUT_DIR = path.join(process.cwd(), 'migration', 'data')

const EXCLUDED_ACCOUNT_IDS = new Set(['87', '21', '58', '60'])
const EXCLUDED_USER_DOMAINS = new Set(['nicotineresource.org', 'tma.org', 'gtnftrust.org', 'truegroup.agency'])

type Account = {
  id: string
  name: string
  personal: string
  status: string
  licenseExpiry: string
  domains: string
}
type AccountUser = { id: string; accountId: string; userId: string; primaryUser: string; createdAt: string }
type OldUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  department: string
  salutation: string
  status: string
  signInCount: string
  lastLoginAt?: string
}

const NULL = '\\N'
const clean = (v: string) => (v === NULL ? undefined : v)

/** Streams the dump once, calling onRow for every data row of the named table's COPY block. */
async function streamTable(tableName: string, onRow: (fields: string[], columns: string[]) => void): Promise<void> {
  const copyPrefix = `COPY public.${tableName} (`
  let inBlock = false
  let columns: string[] = []
  const rl = readline.createInterface({
    input: fs.createReadStream(DUMP_PATH).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    if (!inBlock) {
      if (line.startsWith(copyPrefix)) {
        inBlock = true
        columns = line.slice(line.indexOf('(') + 1, line.indexOf(')')).split(', ')
      }
      continue
    }
    if (line === '\\.') break
    onRow(line.split('\t'), columns)
  }
  rl.close()
}

/** Parses a Postgres text array literal like {a,b,c} or {} into a string array. */
function parsePgArray(raw: string | undefined): string[] {
  if (!raw || raw === '{}') return []
  return raw
    .slice(1, -1)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function mapProviderStatus(oldStatus: string): 'live' | 'trial' | 'pending' {
  if (oldStatus === 'Live') return 'live'
  if (oldStatus === 'Trial') return 'trial'
  return 'pending' // Inactive, Pending
}

function normalizeSalutation(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const v = raw.trim().replace(/\.$/, '').toLowerCase()
  if (v === 'mr') return 'Mr.'
  if (v === 'ms') return 'Ms.'
  if (v === 'mrs') return 'Mrs.'
  if (v === 'dr') return 'Dr.'
  if (v === 'mx') return 'Mx.'
  return undefined
}

async function main() {
  console.log('Pass 1/3: reading accounts...')
  const accounts: Account[] = []
  await streamTable('accounts', (f) => {
    const [id, name, , personal, status, licenseExpiry] = f
    const domains = f[13]
    if (personal !== 'f') return
    if (status === NULL || status === '') return
    if (EXCLUDED_ACCOUNT_IDS.has(id)) return
    accounts.push({ id, name, personal, status, licenseExpiry, domains })
  })
  console.log(`  ${accounts.length} accounts qualify as Access Providers`)

  // Two old accounts can share a name (one real collision found: two
  // "M/A/R/C Research" rows, ids 185 and 2540) — disambiguate before using
  // name as the idempotency key below, or the second import would silently
  // update the first instead of creating a second provider.
  const seenNames = new Set<string>()
  for (const a of accounts) {
    if (seenNames.has(a.name)) {
      a.name = `${a.name} (legacy #${a.id})`
    }
    seenNames.add(a.name)
  }

  const qualifyingAccountIds = new Set(accounts.map((a) => a.id))

  console.log('Pass 2/3: reading account_users, picking one account per user...')
  const accountUsersByUser = new Map<string, AccountUser[]>()
  await streamTable('account_users', (f) => {
    const [id, accountId, userId, , primaryUser, createdAt] = f
    if (!qualifyingAccountIds.has(accountId)) return
    const list = accountUsersByUser.get(userId) ?? []
    list.push({ id, accountId, userId, primaryUser, createdAt })
    accountUsersByUser.set(userId, list)
  })
  const chosenAccountIdByUser = new Map<string, string>()
  for (const [userId, rows] of accountUsersByUser) {
    const primary = rows.find((r) => r.primaryUser === 't')
    const chosen = primary ?? rows.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    chosenAccountIdByUser.set(userId, chosen.accountId)
  }
  console.log(`  ${chosenAccountIdByUser.size} distinct users tied to a qualifying account`)

  console.log('Pass 3/3: reading users, filtering to Active (or Blocked-with-signin), excluding internal domains...')
  const users: OldUser[] = []
  await streamTable('users', (f, columns) => {
    const id = f[0]
    if (!chosenAccountIdByUser.has(id)) return
    const email = f[1]
    const domain = email.split('@')[1]?.toLowerCase()
    if (domain && EXCLUDED_USER_DOMAINS.has(domain)) return
    const status = f[22]
    const signInCount = f[49]
    const everSignedIn = signInCount !== NULL && signInCount !== '0' && signInCount !== ''
    if (status === 'Active' || (status === 'Blocked' && everSignedIn)) {
      users.push({
        id,
        email,
        firstName: f[10],
        lastName: f[11],
        phone: f[17],
        department: f[19],
        salutation: f[21],
        status,
        signInCount,
        lastLoginAt: latestLegacyLogin(f[columns.indexOf('current_sign_in_at')], f[columns.indexOf('last_sign_in_at')]),
      })
    }
  })
  console.log(`  ${users.length} users qualify for import`)

  const payload = await getPayload({ config })

  console.log('\nCreating Access Providers...')
  const providerIdByOldAccountId = new Map<string, string | number>()
  let createdProviders = 0
  let updatedProviders = 0
  for (const a of accounts) {
    const data = {
      name: a.name,
      status: mapProviderStatus(a.status),
      plan: 'none' as const,
      licenseExpiresAt: clean(a.licenseExpiry) ? new Date(a.licenseExpiry).toISOString() : undefined,
      allowedDomains: parsePgArray(a.domains).map((domain) => ({ domain })),
    }
    const existing = await payload.find({
      collection: 'access-providers',
      where: { name: { equals: a.name } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      await payload.update({ collection: 'access-providers', id: existing.docs[0].id, data, overrideAccess: true })
      providerIdByOldAccountId.set(a.id, existing.docs[0].id)
      updatedProviders++
    } else {
      const created = await payload.create({ collection: 'access-providers', data, overrideAccess: true })
      providerIdByOldAccountId.set(a.id, created.id)
      createdProviders++
    }
  }
  console.log(`  ${createdProviders} created, ${updatedProviders} updated`)

  console.log('\nCreating Users...')
  let createdUsers = 0
  let updatedUsers = 0
  let skippedNoProvider = 0
  for (const u of users) {
    const oldAccountId = chosenAccountIdByUser.get(u.id)
    const accessProvider = oldAccountId ? providerIdByOldAccountId.get(oldAccountId) : undefined
    if (!accessProvider) {
      skippedNoProvider++
      continue
    }
    const data = {
      email: u.email.toLowerCase().trim(),
      firstName: clean(u.firstName),
      lastName: clean(u.lastName),
      phone: clean(u.phone),
      department: clean(u.department),
      salutation: normalizeSalutation(clean(u.salutation)),
      status: (u.status === 'Blocked' ? 'suspended' : 'active') as 'active' | 'suspended',
      accessProvider,
      // `_verified` is a Payload-managed field, not part of the public create type.
      _verified: true,
      password: crypto.randomBytes(24).toString('hex'),
    } as any
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: data.email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      const { password, ...updateData } = data
      if (u.lastLoginAt && (!existing.docs[0].lastLoginAt || u.lastLoginAt > existing.docs[0].lastLoginAt))
        updateData.lastLoginAt = u.lastLoginAt
      await payload.update({ collection: 'users', id: existing.docs[0].id, data: updateData, overrideAccess: true })
      updatedUsers++
    } else {
      await payload.create({ collection: 'users', data: { ...data, lastLoginAt: u.lastLoginAt }, overrideAccess: true })
      createdUsers++
    }
  }
  console.log(`  ${createdUsers} created, ${updatedUsers} updated, ${skippedNoProvider} skipped (no provider)`)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(OUT_DIR, 'accessProviderIdMap.json'),
    JSON.stringify(Object.fromEntries(providerIdByOldAccountId), null, 2),
  )
  console.log(`\nWrote old-account-id -> new-provider-id map to migration/data/accessProviderIdMap.json`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
