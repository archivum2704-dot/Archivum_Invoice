import Stripe from 'stripe'
import { PLANS, type PlanId } from '@/lib/pricing'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' as any })
  }
  return _stripe
}

// Price lookup keys — must match exactly what you set in Stripe Dashboard
// Plans:  archivum_starter_monthly | archivum_business_monthly | archivum_pro_monthly
// Addons: archivum_extra_users_monthly | archivum_extra_docs_onetime
export const PRICES = {
  starter:       'archivum_starter_monthly',         // 14,99 €/mes · 2 users · 75 docs/mes
  business:      'archivum_business_monthly',        // 19,99 €/mes · 2 users · 200 docs/mes
  pro:           'archivum_pro_monthly',             // 24,99 €/mes · 2 users · 450 docs/mes
  extraUsers:    'archivum_extra_users_monthly',     // 4,99 €/user/mes (miembro)
  extraDocs:     'archivum_extra_docs_onetime',      // 4,99 € · bono 250 docs (pago único)
  // Kept for backward compatibility with existing subscriptions (no longer sold)
  extraCompanies: 'archivum_extra_companies_monthly',
} as const

export type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due'
  | 'canceled' | 'unpaid' | 'incomplete' | 'paused'

export function isSubscriptionActive(status: SubscriptionStatus) {
  return status === 'active' || status === 'trialing'
}

/**
 * Returns the doc and user limits for a given plan + addons.
 * docsPerPack = 250 (new bono size)
 */
export function computeLimits(extraUsers: number, extraDocs: number, extraCompanies = 0) {
  // We read base limits from PLANS so pricing.ts remains the single source of truth.
  // At runtime we don't know which plan is active here, so callers should use
  // PLANS[planId].docsPerMonth / PLANS[planId].users directly.
  // This helper only computes the DELTA from addons.
  return {
    extraUsersDelta: extraUsers,
    extraDocsDelta:  extraDocs * 250,     // 250 docs per bono
    extraCompaniesDelta: extraCompanies,  // legacy, kept for DB compat
  }
}

/** Full limits for a plan + addons combo */
export function planLimits(planId: PlanId, extraUsers: number, extraDocs: number) {
  const plan = PLANS[planId] ?? PLANS.free
  return {
    maxUsers: plan.users + extraUsers,
    maxDocsPool: plan.docsPerYear + extraDocs * 250,  // annual pool
    docsPerMonth: plan.docsPerMonth,
  }
}
