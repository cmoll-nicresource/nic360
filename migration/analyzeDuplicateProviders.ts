/**
 * Read-only analysis: clusters Access Providers that are probably the same
 * real company, so the merge can be reviewed before anything is changed.
 * Two providers cluster together if they share a normalized name (legal
 * suffixes/punctuation stripped) OR share an allowed domain — unioned
 * transitively, so a 3-way chain (A shares a domain with B, B shares a
 * name with C) merges into one cluster.
 *
 * Usage: npx tsx migration/analyzeDuplicateProviders.ts
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
    if (norm) {
      byNormalizedName.set(norm, [...(byNormalizedName.get(norm) ?? []), String(p.id)])
    }
    for (const d of p.allowedDomains ?? []) {
      const domain = d.domain.toLowerCase().trim()
      byDomain.set(domain, [...(byDomain.get(domain) ?? []), String(p.id)])
    }
  }
  for (const ids of byNormalizedName.values()) {
    for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i])
  }
  for (const ids of byDomain.values()) {
    for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i])
  }

  const userCounts = new Map<string, number>()
  for (const p of providers) {
    const count = await payload.count({
      collection: 'users',
      where: { accessProvider: { equals: p.id } },
      overrideAccess: true,
    })
    userCounts.set(String(p.id), count.totalDocs)
  }

  const clusters = new Map<string, typeof providers>()
  for (const p of providers) {
    const root = uf.find(String(p.id))
    clusters.set(root, [...(clusters.get(root) ?? []), p])
  }

  const multiClusters = [...clusters.values()].filter((c) => c.length > 1)
  multiClusters.sort((a, b) => b.length - a.length)

  console.log(`${providers.length} total providers, ${multiClusters.length} clusters with duplicates\n`)

  for (const cluster of multiClusters) {
    const totalUsers = cluster.reduce((sum, p) => sum + (userCounts.get(String(p.id)) ?? 0), 0)
    console.log(`--- cluster (${cluster.length} providers, ${totalUsers} users total) ---`)
    for (const p of cluster) {
      const domains = (p.allowedDomains ?? []).map((d) => d.domain).join(',') || '(no domains)'
      console.log(
        `  [${p.id}] "${p.name}" — ${p.status}/${p.plan} — ${userCounts.get(String(p.id))} users — ${domains}`,
      )
    }
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
