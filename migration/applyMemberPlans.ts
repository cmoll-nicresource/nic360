/**
 * Applies the real current-membership list (provided directly by staff,
 * not derived from old-site data) onto Access Providers: Key Sponsor or
 * any "Platinum" N360 note -> premium; every other listed member -> base;
 * anything not on the list -> none (explicit reset, not just "leave
 * alone" — the old migrated plan values were placeholders).
 *
 * Matching is by provider id, resolved by hand against the real 180-row
 * provider list (name variants/typos/legal-entity differences the earlier
 * automated merge didn't catch, e.g. "Core-Mark Holding Company Inc." /
 * "Core-Mark Internatiional Inc." (typo) / "Core-Mark International Inc."
 * are three separate rows for the same real member) — not string-matched
 * at runtime, since several of those judgment calls (is "Citi Research" the
 * same real member as "Citigroup Global Markets Inc."? is "Pillar HC" the
 * same as "Pillar Clinical Research"?) aren't safe to automate.
 *
 * Deliberately left unmatched (stay 'none'), flagged for a human to
 * confirm rather than guessed: KS BAT RAI Services Company, Pillar HC,
 * Republic Brands (maybe DRL Enterprises / ex-Republic Tobacco, LLP?),
 * and Citi / Citi Research (same real member as Citigroup Global Markets
 * Inc., or different ones?). Two real members have no Access Provider at
 * all yet (no migrated users ever existed under them): PT Djarum, Cigar
 * Rights of America.
 *
 * Usage: npx tsx migration/applyMemberPlans.ts
 */
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config'

// Provider ids grouped by real-world company, matched against the member
// list. A company can map to several provider ids (old near-duplicates /
// legal-entity variants that represent the same real member).
const PREMIUM_IDS = [
  111, 145, 180, // Alliance One International (Alliance One / Pyxus International / AOI-Pyxus)
  128, 196, // Altria Client Services (Altria / Altria Client Services)
  105, // Anchor Stockbrokers
  106, // Applied Research and Analysis Co
  102, // BAT (British American Tobacco)
  230, // Citigroup Global Markets Inc.
  304, // G.D. Spa
  282, 201, // Grand River Enterprises (+ Six Nations Ltd.)
  143, // Haypp Group
  268, 227, // ITG Brands, LLC (+ "ITG Bands" typo)
  177, // Morgan Stanley
  154, // PMI US Corporate Services, Inc (PMI)
  301, 122, // Smoore (Hong Kong) Limited (Shenzhen Smoore Technology Limited / Smoore)
  330, // Swisher International, Inc.
  178, // Turning Point Brands
  127, 157, 146, // Universal Corporation (Universal / Universal Leaf / Universal Leaf Tobacco Company)
]

const BASE_IDS = [
  298, // A.S.P. Enterprises, Inc.
  313, // Arango Cigar Co.
  235, // Avior Inc.
  341, 224, // Baker & Hostetler, LLC
  161, // Black Buffalo Inc.
  179, // CA Office of Attorney General (California Office of the Attorney General)
  194, // Cabbacis
  181, // Chemular
  216, // Cheyenne International
  220, 259, 229, // Core-Mark Holding Company Inc. (+ Internatiional typo + International)
  212, // Delfort Group
  197, // EAS Consulting Group, LLC
  343, // Emplicure
  186, // Filtrona
  209, // Fox Rothschild LLP
  171, // Greentank Technologies Corp
  245, 204, // Hail & Cotton, Inc. (+ International B.V.)
  217, 185, // IGEN (+ IGEN Tax)
  315, // Indivate
  251, // JEB International Tobacco Co.
  221, // Jefferies LLC
  160, 174, 232, // JTI Liggett (JTI USA / Liggett Group / Liggett Vector Brands Inc.)
  349, 317, // Juul Labs Inc. (JUUL Labs / Juul)
  172, 219, 241, 242, 269, // Korea Tobacco & Ginseng Corp (KT&G family)
  236, // Kretek International
  198, // Labstat International
  318, // Laudisi Enterprises
  167, 319, // M/A/R/C Research (+ legacy duplicate)
  281, // Management Science Associates
  126, 285, // MANE Inc. (+ MANE FILS)
  329, // McKinney Specialty Labs
  162, // McLane Company Inc
  294, 169, // Merrill Lynch Bank of America (+ Bank of America)
  189, 302, // MetsÃ¤ Board Corporation (Metsa Board Head Office + International Ltd.)
  264, // Mountain Service Distributors
  284, 192, // National Assoc of Tobacco Outlets (+ (NATO))
  279, // Pinney Associates, Inc.
  149, // Premier Manufacturing, Inc.
  155, // Sanova.co
  314, // SBG Securities
  312, // Schweitzer Mauduit International Inc.
  170, 120, // Shenzhen Zinwi Bio-Tech Co., Ltd. (+ Zinwi)
  250, // Smoker Friendly
  296, // Specialty Tobacco Council
  199, // Stifel Nicolaus
  342, // Stryk Brands Inc
  306, // The Tobacco Institute of India
  213, // Tobacco Rag Processors
  158, 239, // Tobacco Technology, Inc. (+ Tobacco Technologies)
  215, // Top Shelf Tobacco, LLC
  333, // Troutman Pepper Locke
  323, // WANHub
  115, // WOW Solutions
  288, // Xcaliber International Ltd
]

async function main() {
  const payload = await getPayload({ config })

  const { totalDocs: allCount } = await payload.count({ collection: 'access-providers', overrideAccess: true })
  console.log(`${allCount} total Access Providers`)

  const matchedIds = new Set([...PREMIUM_IDS, ...BASE_IDS])

  // licenseExpiresAt cleared explicitly — several providers carry a stale
  // expired date from the original migration (e.g. Altria's 2025-09-16),
  // which would otherwise leave them ineffective despite status: live.
  // This is a current real membership list with no expiry given, so blank
  // (no expiry) is the honest value, not a guess.
  let premiumSet = 0
  for (const id of PREMIUM_IDS) {
    try {
      await payload.update({
        collection: 'access-providers',
        id,
        data: { plan: 'premium', status: 'live', licenseExpiresAt: null },
        overrideAccess: true,
      })
      premiumSet++
    } catch (err) {
      console.error(`  FAILED premium id ${id}: ${err instanceof Error ? err.message : err}`)
    }
  }
  console.log(`${premiumSet} providers set to premium/live`)

  let baseSet = 0
  for (const id of BASE_IDS) {
    try {
      await payload.update({
        collection: 'access-providers',
        id,
        data: { plan: 'base', status: 'live', licenseExpiresAt: null },
        overrideAccess: true,
      })
      baseSet++
    } catch (err) {
      console.error(`  FAILED base id ${id}: ${err instanceof Error ? err.message : err}`)
    }
  }
  console.log(`${baseSet} providers set to base/live`)

  const { docs: allProviders } = await payload.find({ collection: 'access-providers', limit: 500, depth: 0, overrideAccess: true })
  let resetToNone = 0
  for (const p of allProviders) {
    if (matchedIds.has(Number(p.id))) continue
    if (p.plan === 'none') continue
    await payload.update({ collection: 'access-providers', id: p.id, data: { plan: 'none' }, overrideAccess: true })
    resetToNone++
  }
  console.log(`${resetToNone} unmatched providers reset to plan: none (not on the member list)`)

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
