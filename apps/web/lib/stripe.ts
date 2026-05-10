import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    _stripe = new Stripe(key, { apiVersion: '2025-04-30.basil', typescript: true })
  }
  return _stripe
}

// Price lookup keys — must match exactly what you set in Stripe Dashboard
export const PRICES = {
  base:            'archivum_base_monthly',            // €10/month — 5 users, 500 docs, 20 companies
  extraUsers:      'archivum_extra_users_monthly',     // €2/user/month
  extraDocs:       'archivum_extra_docs_monthly',      // €5/month per +200 docs
  extraCompanies:  'archivum_extra_companies_monthly', // €2/company/month
} as const

// Free tier limits (no subscription)
export const FREE_LIMITS = {
  users:     1,
  docs:      20,
  companies: 1,
} as const

// Paid plan base limits
export const LIMITS = {
  users:       5,
  docs:        500,
  docsPerPack: 200,
  companies:   20,
} as const

export type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due'
  | 'canceled' | 'unpaid' | 'incomplete' | 'paused'

export function isSubscriptionActive(status: SubscriptionStatus) {
  return status === 'active' || status === 'trialing'
}

export function computeLimits(extraUsers: number, extraDocs: number, extraCompanies: number) {
  return {
    maxUsers:     LIMITS.users     + extraUsers,
    maxDocs:      LIMITS.docs      + extraDocs * LIMITS.docsPerPack,
    maxCompanies: LIMITS.companies + extraCompanies,
  }
}
