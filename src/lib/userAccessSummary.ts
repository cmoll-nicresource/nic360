import { providerIsEffective } from '@/access/subscriptionPlan'
import type { AccessProvider } from '@/payload-types'

export type AccessTone = 'premium' | 'base' | 'none' | 'blocked'

export type UserAccessSummary = {
  tone: AccessTone
  /** Short headline shown on the user's edit screen. */
  headline: string
  /** One line of explanation: which provider, its status and expiry, or why access is off. */
  detail: string
}

type ProviderInfo = Pick<AccessProvider, 'name' | 'plan' | 'status' | 'licenseExpiresAt'>

const PLAN_NAME = { premium: 'Premium', base: 'Base', none: 'None' } as const
const STATUS_NAME = { pending: 'Pending', trial: 'Trial', live: 'Live' } as const

const day = (iso: string) => iso.slice(0, 10)

/**
 * What a staff member needs to know about a user's subscription at a glance.
 * Mirrors getSubscriptionPlan (the rule that actually gates content) but also
 * says why access is off, so "None" is not a mystery.
 */
export function summarizeUserAccess(
  input: { provider: ProviderInfo | null; suspended?: boolean; verified?: boolean },
  now: number = Date.now(),
): UserAccessSummary {
  const { provider, suspended, verified } = input

  if (!provider) {
    return {
      tone: 'none',
      headline: 'Non-subscribing',
      detail: 'No access provider. This user can sign in and see events they registered for, but no subscription content.',
    }
  }

  const planName = PLAN_NAME[provider.plan] ?? provider.plan
  const statusName = STATUS_NAME[provider.status] ?? provider.status
  const expiry = provider.licenseExpiresAt ? `, expires ${day(provider.licenseExpiresAt)}` : ''
  const via = `${provider.name}: ${planName} plan, ${statusName}${expiry}`

  if (suspended) {
    return { tone: 'blocked', headline: 'Suspended: no access', detail: `${via}. The account is suspended, so nothing is available.` }
  }
  if (verified === false) {
    return { tone: 'blocked', headline: 'Email not verified: no access yet', detail: `${via}. Access starts once the user confirms their email address.` }
  }
  if (!providerIsEffective(provider, now)) {
    const reason =
      provider.status === 'pending'
        ? 'The provider is still pending.'
        : provider.licenseExpiresAt && new Date(provider.licenseExpiresAt).getTime() < now
          ? 'The provider\'s license has expired.'
          : 'The provider is not active.'
    return { tone: 'blocked', headline: 'Provider not active: no access', detail: `${via}. ${reason}` }
  }
  if (provider.plan === 'premium') return { tone: 'premium', headline: 'Premium subscriber', detail: via }
  if (provider.plan === 'base') return { tone: 'base', headline: 'Base subscriber', detail: via }
  return { tone: 'none', headline: 'Non-subscribing', detail: `${via}. The provider is active but has no subscription plan.` }
}
