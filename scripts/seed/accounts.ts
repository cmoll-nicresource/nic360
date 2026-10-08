import type { Payload } from 'payload'

export const SEED_PASSWORD = 'ChangeMe123!'

export async function seedAccounts(payload: Payload) {
  console.log('Seeding staff...')
  const staffSeed = [
    { name: 'Pat "Papa" Okonkwo', email: 'papa@nicotine360.org', role: 'admin' as const },
    { name: 'Dana Whitfield', email: 'dana@nicotine360.org', role: 'gatekeeper' as const },
    { name: 'Priya Srinivasan', email: 'priya@nicotine360.org', role: 'gatekeeper' as const },
    { name: 'Sam Okafor', email: 'sam@nicotine360.org', role: 'editor' as const },
    { name: 'Jordan Vance', email: 'jordan@nicotine360.org', role: 'editor' as const },
  ]
  for (const s of staffSeed) {
    await payload.create({
      collection: 'staff',
      data: { ...s, password: SEED_PASSWORD },
      overrideAccess: true,
    })
  }

  console.log('Seeding access providers...')
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  const providerSeed = [
    {
      name: 'ITC Limited',
      status: 'live' as const,
      plan: 'premium' as const,
      licenseExpiresAt: oneYearFromNow,
      allowedDomains: [], // no allowed domains; its one user is attached by hand (see entity map)
    },
    {
      name: 'Altria Group',
      status: 'live' as const,
      plan: 'base' as const,
      licenseExpiresAt: oneYearFromNow,
      allowedDomains: [{ domain: 'altria.com' }],
    },
    {
      name: 'Philip Morris International',
      status: 'live' as const,
      plan: 'premium' as const,
      licenseExpiresAt: oneYearFromNow,
      allowedDomains: [{ domain: 'pmi.com' }],
    },
    {
      name: 'Juul Labs',
      status: 'trial' as const,
      plan: 'base' as const,
      licenseExpiresAt: oneYearFromNow,
      allowedDomains: [{ domain: 'juul.com' }],
    },
    {
      name: 'Vapor Ventures LLC',
      status: 'trial' as const,
      plan: 'premium' as const,
      licenseExpiresAt: oneYearFromNow,
      allowedDomains: [{ domain: 'vaporventures.io' }],
    },
    {
      name: 'British American Tobacco',
      status: 'live' as const,
      plan: 'premium' as const,
      licenseExpiresAt: oneYearAgo, // expired: should read as 'none' despite Live + Premium
      allowedDomains: [{ domain: 'bat.com' }],
    },
    {
      name: 'Swisher International',
      status: 'pending' as const,
      plan: 'base' as const,
      licenseExpiresAt: null,
      allowedDomains: [{ domain: 'swisher.com' }],
    },
    {
      name: 'Imperial Brands',
      status: 'live' as const,
      plan: 'none' as const,
      licenseExpiresAt: oneYearFromNow,
      allowedDomains: [{ domain: 'imperialbrands.com' }],
    },
  ]

  const providers: Record<string, number> = {}
  for (const p of providerSeed) {
    const doc = await payload.create({
      collection: 'access-providers',
      data: p,
      overrideAccess: true,
    })
    providers[p.name] = doc.id
  }

  console.log('Seeding users...')
  const userSeed = [
    // ITC Limited: attached by hand, no matching allowedDomains
    {
      firstName: 'Rohan',
      lastName: 'Kapoor',
      email: 'rohan.kapoor@gmail.com',
      accessProvider: providers['ITC Limited'],
    },
    // Altria Group (Live, Base)
    {
      firstName: 'Megan',
      lastName: 'Clarke',
      email: 'megan.clarke@altria.com',
      accessProvider: providers['Altria Group'],
    },
    {
      firstName: 'Devon',
      lastName: 'Price',
      email: 'devon.price@altria.com',
      accessProvider: providers['Altria Group'],
    },
    // Philip Morris International (Live, Premium)
    {
      firstName: 'Elena',
      lastName: 'Rossi',
      email: 'elena.rossi@pmi.com',
      accessProvider: providers['Philip Morris International'],
    },
    {
      firstName: 'Marcus',
      lastName: 'Webb',
      email: 'marcus.webb@pmi.com',
      accessProvider: providers['Philip Morris International'],
    },
    // Juul Labs (Trial, Base)
    {
      firstName: 'Taylor',
      lastName: 'Nguyen',
      email: 'taylor.nguyen@juul.com',
      accessProvider: providers['Juul Labs'],
    },
    // Vapor Ventures LLC (Trial, Premium)
    {
      firstName: 'Casey',
      lastName: 'Morrison',
      email: 'casey.morrison@vaporventures.io',
      accessProvider: providers['Vapor Ventures LLC'],
    },
    // British American Tobacco (Live, Premium, but expired)
    {
      firstName: 'Ian',
      lastName: 'Fletcher',
      email: 'ian.fletcher@bat.com',
      accessProvider: providers['British American Tobacco'],
    },
    // Swisher International (Pending, Base)
    {
      firstName: 'Lauren',
      lastName: 'Hayes',
      email: 'lauren.hayes@swisher.com',
      accessProvider: providers['Swisher International'],
    },
    // Imperial Brands (Live, None)
    {
      firstName: 'Noah',
      lastName: 'Bennett',
      email: 'noah.bennett@imperialbrands.com',
      accessProvider: providers['Imperial Brands'],
    },
    // Event-only attendee: no access provider at all
    {
      firstName: 'Zoe',
      lastName: 'Harrington',
      email: 'zoe.harrington@gmail.com',
      accessProvider: null,
    },
  ] as const

  for (const u of userSeed) {
    await payload.create({
      collection: 'users',
      // `_verified` is a Payload-managed field, not part of the public create type.
      data: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        password: SEED_PASSWORD,
        accessProvider: u.accessProvider ?? undefined,
        _verified: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      disableVerificationEmail: true,
    })
  }

  // Demonstrate the real flow: a new hire at an already-onboarded company signs up and
  // verifies their email, and the afterChange hook attaches their Access Provider for them.
  console.log('Seeding one unverified user to demonstrate verify-time auto-join...')
  const newHire = await payload.create({
    collection: 'users',
    data: {
      firstName: 'Harper',
      lastName: 'Diallo',
      email: 'harper.diallo@pmi.com',
      password: SEED_PASSWORD,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
    disableVerificationEmail: true,
  })
  console.log(`  Created unverified, accessProvider = ${newHire.accessProvider ?? 'none yet'}`)

  await payload.update({
    collection: 'users',
    id: newHire.id,
    data: { _verified: true },
    overrideAccess: true,
  })
  // The hook's own payload.update happens asynchronously inside afterChange; re-fetch to see it.
  const settledHire = await payload.findByID({ collection: 'users', id: newHire.id, depth: 0 })
  console.log(
    `  After verification, accessProvider = ${settledHire.accessProvider ?? 'none'} (expected: ${providers['Philip Morris International']})`,
  )
}
