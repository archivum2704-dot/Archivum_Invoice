import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
  typescript: true,
})

// Price lookup keys — must match exactly what you set in Stripe Dashboard
export const PRICES = {
  base:       'archivum_base_monthly',       // €10/month — 5 users, 500 docs
  extraUsers: 'archivum_extra_users_monthly', // €2/user/month
  extraDocs:  'archivum_extra_docs_monthly',  // €5/month per +200 docs
} as const

// Base plan limits
export const LIMITS = {
  users:    5,
  docs:     500,
  docsPerPack: 200,
} as const

export type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due'
  | 'canceled' | 'unpaid' | 'incomplete' | 'paused'

export function isSubscriptionActive(status: SubscriptionStatus) {
  return status === 'active' || status === 'trialing'
}

export function computeLimits(extraUsers: number, extraDocs: number) {
  return {
    maxUsers: LIMITS.users + extraUsers,
    maxDocs:  LIMITS.docs  + extraDocs * LIMITS.docsPerPack,
  }
}
