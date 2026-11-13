import { createHash, randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'

export class ProviderMergeError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function providerMergeIds(source: unknown, target: unknown) {
  const parse = (id: unknown) => {
    if (!['string', 'number'].includes(typeof id) || !/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) > 2147483647)
      throw new ProviderMergeError('Choose two valid access providers.')
    return Number(id)
  }
  const sourceId = parse(source), targetId = parse(target)
  if (sourceId === targetId) throw new ProviderMergeError('Choose a different provider to merge into.')
  return { sourceId, targetId }
}

type ProviderRow = { id: number; name: string; plan: string; status: string; license_expires_at: Date | null; updated_at: Date }
type DomainRow = { id: string; _parent_id: number; _order: number; domain: string }
type MembershipRow = { id: number; access_provider_id: number }
export type ProviderMergePreview = {
  source: { id: number; name: string; plan: string; status: string; expiresAt: string | null; users: number }
  target: { id: number; name: string; plan: string; status: string; expiresAt: string | null; users: number }
  domainsToAdd: string[]
  combinedDomains: string[]
  discountCodesToMove: number
  fingerprint: string
}

/** Caller owns the transaction. Row locks also prevent new foreign-key assignments during a merge. */
export async function inspectProviderMerge(client: Pick<PoolClient, 'query'>, sourceId: number, targetId: number, lock = false) {
  providerMergeIds(sourceId, targetId)
  const ids = [sourceId, targetId].sort((a, b) => a - b)
  const suffix = lock ? ' FOR UPDATE' : ''
  const { rows: providers } = await client.query<ProviderRow>(
    `SELECT id,name,plan,status,license_expires_at,updated_at FROM access_providers WHERE id=ANY($1::int[]) ORDER BY id${suffix}`, [ids],
  )
  if (providers.length !== 2) throw new ProviderMergeError('One of these providers no longer exists. Choose again.', 409)
  const { rows: domains } = await client.query<DomainRow>(
    `SELECT id,_parent_id,_order,domain FROM access_providers_allowed_domains WHERE _parent_id=ANY($1::int[]) ORDER BY _parent_id,_order,id${suffix}`, [ids],
  )
  const { rows: users } = await client.query<MembershipRow>(
    `SELECT id,access_provider_id FROM users WHERE access_provider_id=ANY($1::int[]) ORDER BY id${suffix}`, [ids],
  )
  const { rows: discounts } = await client.query<MembershipRow>(
    `SELECT id,access_provider_id FROM discount_codes WHERE access_provider_id=ANY($1::int[]) ORDER BY id${suffix}`, [ids],
  )
  const summarize = (id: number) => {
    const p = providers.find(p => p.id === id)!
    return { id, name: p.name, plan: p.plan, status: p.status, expiresAt: p.license_expires_at?.toISOString() ?? null, users: users.filter(u => u.access_provider_id === id).length }
  }
  const normalized = (id: number) => domains.filter(d => d._parent_id === id).map(d => d.domain.trim().toLowerCase()).filter(Boolean)
  const targetDomains = new Set(normalized(targetId))
  const domainsToAdd = [...new Set(normalized(sourceId))].filter(d => !targetDomains.has(d)).sort()
  const preview: ProviderMergePreview = {
    source: summarize(sourceId), target: summarize(targetId), domainsToAdd,
    combinedDomains: [...new Set([...targetDomains, ...domainsToAdd])].sort(),
    discountCodesToMove: discounts.filter(d => d.access_provider_id === sourceId).length,
    fingerprint: createHash('sha256').update(JSON.stringify({ sourceId, targetId, providers, domains, users, discounts })).digest('hex'),
  }
  return { preview, domains }
}

/** Narrow SQL updates preserve passwords, verification, suspension and publication choices; no email hooks run. */
export async function applyProviderMerge(client: Pick<PoolClient, 'query'>, sourceId: number, targetId: number, fingerprint: string) {
  const { preview, domains } = await inspectProviderMerge(client, sourceId, targetId, true)
  if (!fingerprint || fingerprint !== preview.fingerprint)
    throw new ProviderMergeError('These providers changed since the preview. Preview the merge again.', 409)
  let order = Math.max(0, ...domains.filter(d => d._parent_id === targetId).map(d => d._order))
  for (const domain of preview.domainsToAdd) {
    await client.query('INSERT INTO access_providers_allowed_domains(id,_parent_id,_order,domain) VALUES ($1,$2,$3,$4)', [randomUUID(), targetId, ++order, domain])
  }
  await client.query('UPDATE users SET access_provider_id=$2,updated_at=now() WHERE access_provider_id=$1', [sourceId, targetId])
  await client.query('UPDATE discount_codes SET access_provider_id=$2,updated_at=now() WHERE access_provider_id=$1', [sourceId, targetId])
  await client.query('UPDATE access_providers SET updated_at=now() WHERE id=$1', [targetId])
  await client.query('DELETE FROM access_providers_allowed_domains WHERE _parent_id=$1', [sourceId])
  await client.query('DELETE FROM access_providers WHERE id=$1', [sourceId])
  return preview
}
