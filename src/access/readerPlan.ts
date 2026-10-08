import type { Payload } from 'payload'

import type { AccessProvider, User } from '@/payload-types'

export type ReaderPlan = 'none' | 'base' | 'premium'

/**
 * A provider only grants access while it's Trial or Live and not past its
 * license expiry. Pending and expired providers grant nothing, whatever
 * their plan says.
 */
function providerIsEffective(provider: AccessProvider): boolean {
  if (provider.status !== 'trial' && provider.status !== 'live') return false
  if (provider.licenseExpiresAt) {
    if (new Date(provider.licenseExpiresAt).getTime() < Date.now()) return false
  }
  return true
}

/**
 * The single source of truth for "what can this reader see." Every
 * access.read function and protected route should call this instead of
 * re-deriving plan logic from the provider fields directly.
 */
export async function getReaderPlan(
  user: Pick<User, 'accessProvider'> | null | undefined,
  payload: Payload,
): Promise<ReaderPlan> {
  if (!user?.accessProvider) return 'none'

  const provider =
    typeof user.accessProvider === 'object'
      ? user.accessProvider
      : await payload
          .findByID({
            collection: 'access-providers',
            id: user.accessProvider,
            depth: 0,
          })
          .catch(() => null)

  if (!provider || !providerIsEffective(provider)) return 'none'

  if (provider.plan === 'premium') return 'premium'
  if (provider.plan === 'base') return 'base'
  return 'none'
}

export function planSatisfies(plan: ReaderPlan, required: 'base' | 'premium'): boolean {
  if (plan === 'none') return false
  if (required === 'base') return true // base or premium both satisfy a base requirement
  return plan === 'premium'
}
