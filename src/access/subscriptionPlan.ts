import type { Payload } from 'payload'

import type { AccessProvider, User } from '@/payload-types'

export type SubscriptionPlan = 'none' | 'base' | 'premium'

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
 * The single source of truth for a user's effective subscription plan.
 * Subscription-gated access checks call this rather than re-deriving
 * provider rules. Conference registration is checked separately.
 */
export async function getSubscriptionPlan(
  user:
    (Pick<User, 'accessProvider'> & Partial<Pick<User, 'status' | '_verified'>>) | null | undefined,
  payload: Payload,
): Promise<SubscriptionPlan> {
  if (!user?.accessProvider || user.status === 'suspended' || user._verified === false)
    return 'none'

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

export function planSatisfies(plan: SubscriptionPlan, required: 'base' | 'premium'): boolean {
  if (plan === 'none') return false
  if (required === 'base') return true // base or premium both satisfy a base requirement
  return plan === 'premium'
}
