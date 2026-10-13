/**
 * Executes the merge proposed by analyzeDuplicateProviders.ts: for every
 * cluster of Access Providers that are the same real company (same
 * normalized name or a shared allowed domain, unioned transitively), picks
 * one canonical provider, reassigns every User pointing at any other
 * member of the cluster to it, unions their allowed domains onto it, keeps
 * whichever status/plan in the cluster grants the most access (so merging
 * never silently downgrades someone), then deletes the rest.
 *
 * There's no more "primary account" concept to preserve — a user who was
 * split across what are now considered duplicate accounts of the same
 * company just ends up with one, the normal case for everyone else too.
 *
 * Usage: npx tsx migration/mergeDuplicateAccessProviders.ts
 */
import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config'

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[.,]/g, '')
    .replace(/\b(inc|incorporated|llc|l l c|ltd|limited|co|corp|corporation|lp|llp|plc|group|holdings?|usa|international|intl)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

const STATUS_RANK = { live: 2, trial: 1, pending: 0 } as const
const PLAN_RANK = { premium: 2, base: 1, none: 0 } as const

class UnionFind {
  parent = new Map<string, string>()
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    const p = this.parent.get(x)!
    if (p === x) return x
    const root = this.find(p)
    this.parent.set(x, root)
    return root
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

async function main() {
  const payload = await getPayload({ config })

  const { docs: providers } = await payload.find({
    collection: 'access-providers',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })

  const uf = new UnionFind()
  for (const p of providers) uf.find(String(p.id))

  const byNormalizedName = new Map<string, string[]>()
  const byDomain = new Map<string, string[]>()
  for (const p of providers) {
    const norm = normalizeName(p.name)
    if (norm) byNormalizedName.set(norm, [...(byNormalizedName.get(norm) ?? []), String(p.id)])
    for (const d of p.allowedDomains ?? []) {
      const domain = d.domain.toLowerCase().trim()
      byDomain.set(domain, [...(byDomain.get(domain) ?? []), String(p.id)])
    }
  }
  for (const ids of byNormalizedName.values()) for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i])
  for (const ids of byDomain.values()) for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i])

  const userCounts = new Map<string, number>()
  for (const p of providers) {
    const { totalDocs } = await payload.count({
      collection: 'users',
      where: { accessProvider: { equals: p.id } },
      overrideAccess: true,
    })
    userCounts.set(String(p.id), totalDocs)
  }

  const clusters = new Map<string, typeof providers>()
  for (const p of providers) {
    const root = uf.find(String(p.id))
    clusters.set(root, [...(clusters.get(root) ?? []), p])
  }
  const multiClusters = [...clusters.values()].filter((c) => c.length > 1)

  console.log(`Merging ${multiClusters.length} clusters (${providers.length} providers total)...\n`)

  let totalDeleted = 0
  let totalUsersReassigned = 0

  for (const cluster of multiClusters) {
    const sorted = [...cluster].sort((a, b) => {
      const byUsers = (userCounts.get(String(b.id)) ?? 0) - (userCounts.get(String(a.id)) ?? 0)
      if (byUsers !== 0) return byUsers
      const byDomainCount = (b.allowedDomains?.length ?? 0) - (a.allowedDomains?.length ?? 0)
      if (byDomainCount !== 0) return byDomainCount
      return Number(a.id) - Number(b.id)
    })
    const canonical = sorted[0]
    const rest = sorted.slice(1)

    const mergedDomains = new Map<string, string>()
    for (const p of cluster) {
      for (const d of p.allowedDomains ?? []) {
        mergedDomains.set(d.domain.toLowerCase().trim(), d.domain.trim())
      }
    }
    const bestStatus = cluster.reduce((best, p) => (STATUS_RANK[p.status] > STATUS_RANK[best] ? p.status : best), canonical.status)
    const bestPlan = cluster.reduce((best, p) => (PLAN_RANK[p.plan] > PLAN_RANK[best] ? p.plan : best), canonical.plan)

    console.log(`"${canonical.name}" [${canonical.id}] absorbs: ${rest.map((p) => `"${p.name}" [${p.id}]`).join(', ')}`)

    await payload.update({
      collection: 'access-providers',
      id: canonical.id,
      data: {
        status: bestStatus,
        plan: bestPlan,
        allowedDomains: [...mergedDomains.values()].map((domain) => ({ domain })),
      },
      overrideAccess: true,
    })

    for (const p of rest) {
      const { docs: usersToMove } = await payload.find({
        collection: 'users',
        where: { accessProvider: { equals: p.id } },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      for (const u of usersToMove) {
        await payload.update({
          collection: 'users',
          id: u.id,
          data: { accessProvider: canonical.id },
          overrideAccess: true,
        })
        totalUsersReassigned++
      }
      await payload.delete({ collection: 'access-providers', id: p.id, overrideAccess: true })
      totalDeleted++
    }
  }

  console.log(`\nDone. Deleted ${totalDeleted} duplicate providers, reassigned ${totalUsersReassigned} users.`)
  const { totalDocs: remaining } = await payload.count({ collection: 'access-providers', overrideAccess: true })
  console.log(`${remaining} Access Providers remain.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
