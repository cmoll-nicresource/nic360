/**
 * Creates the real `staff` collection entries for the five people who will
 * actually administer the new site, confirmed by hand against the old
 * database's `account_users.roles` (NOT `users.admin`, which was essentially
 * unused — only 1 true row out of 8,837 users).
 *
 * Passwords are not migrated (the old site's bcrypt hashes aren't usable
 * here) — each account gets a random throwaway password and must use the
 * admin login page's "forgot password" flow to set a real one.
 *
 * Usage: npx tsx migration/importStaff.ts
 */
import 'dotenv/config'
import crypto from 'crypto'
import { getPayload } from 'payload'

import config from '../src/payload.config'

const STAFF = [
  { email: 'cmoll@nicotineresource.org', name: 'Chris Moll', role: 'admin' as const },
  { email: 'mparisi@nicotineresource.org', name: 'Michelle Parisi', role: 'gatekeeper' as const },
  { email: 'kpace@nicotineresource.org', name: 'Karen Pace', role: 'gatekeeper' as const },
  { email: 'mdean@nicotineresource.org', name: 'Marissa Dean', role: 'editor' as const },
  { email: 'mmacdonald@nicotineresource.org', name: 'Mike Macdonald', role: 'editor' as const },
]

async function main() {
  const payload = await getPayload({ config })

  for (const s of STAFF) {
    const existing = await payload.find({
      collection: 'staff',
      where: { email: { equals: s.email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'staff',
        id: existing.docs[0].id,
        data: { name: s.name, role: s.role },
        overrideAccess: true,
      })
      console.log(`  updated existing: ${s.email} (${s.role})`)
      continue
    }

    await payload.create({
      collection: 'staff',
      data: {
        email: s.email,
        name: s.name,
        role: s.role,
        password: crypto.randomBytes(24).toString('hex'),
      },
      overrideAccess: true,
    })
    console.log(`  created: ${s.email} (${s.role}) — needs a password reset before first login`)
  }

  console.log('\nDone. Have each person use "Forgot password" at /admin/login to set their own password.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
