/**
 * Archivum — Pricing constants (mobile mirror of apps/web/lib/pricing.ts)
 * Keep in sync with the web version.
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Gratuito",
    price: 0,
    priceLabel: "0 €",
    docsPerMonth: 20,
    docsPerYear: 250,
    storageGB: 0.5,
    users: 1,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 14.99,
    priceLabel: "14,99 €/mes",
    docsPerMonth: 75,
    docsPerYear: 900,
    storageGB: 1.8,
    users: 2,
  },
  business: {
    id: "business",
    name: "Business",
    price: 19.99,
    priceLabel: "19,99 €/mes",
    docsPerMonth: 200,
    docsPerYear: 2400,
    storageGB: 4.8,
    users: 2,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 24.99,
    priceLabel: "24,99 €/mes",
    docsPerMonth: 450,
    docsPerYear: 5400,
    storageGB: 10.8,
    users: 2,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const ADDONS = {
  extraDocs: {
    label: "Bono 250 documentos extra",
    sublabel: "Pago único · sin caducidad",
    price: 4.99,
    docs: 250,
  },
  extraUser: {
    label: "Usuario adicional (miembro)",
    sublabel: "Por usuario / mes",
    price: 4.99,
  },
} as const;

// ── Entitlements ─────────────────────────────────────────────────────────────

/**
 * The billing columns every limit is derived from.
 *
 * plan and status are required, not optional: a caller that forgets to select
 * subscription_plan would otherwise fall through to the free tier and quietly
 * report the wrong limit — which is exactly how the clients screen came to
 * show "1/1" on a Pro organization. Missing them is now a compile error.
 */
export type BillingRow = {
  subscription_plan: string | null
  subscription_status: string | null
  extra_users_quantity?: number | null
  extra_docs_quantity?: number | null
  extra_companies_quantity?: number | null
}

export type Entitlements = {
  planId: PlanId
  /** The plan is in force (paid and current, or granted by an admin). */
  isActive: boolean
  maxUsers: number
  maxDocs: number
  maxCompanies: number
}

/** Platform admins are never capped; a number, not Infinity, so it renders. */
export const UNLIMITED = 999_999

/** Statuses that mean the plan is in force right now. */
const ACTIVE_STATUSES = ['active', 'trialing']

/** Clients (companies) allowed on a paid plan before add-ons. */
const PAID_BASE_COMPANIES = 20

/**
 * The single definition of what an organization is entitled to.
 *
 * Everything — the counters on screen and the checks that refuse a create —
 * must read its limits from here. They used to be worked out in three places
 * with three different rules: one required a Stripe subscription, one only
 * looked at the status, and one ignored both. An organization on a
 * hand-granted plan was told it had 2 user slots and then refused the second.
 *
 * A Stripe subscription is deliberately *not* required: plans granted from the
 * admin panel are just as real. What makes that safe is that the billing
 * columns are writable only by the service role and platform admins — see the
 * protect_billing_columns trigger.
 */
export function resolveEntitlements(
  org: BillingRow | null | undefined,
  opts: { isPlatformAdmin?: boolean } = {},
): Entitlements {
  const planId = ((org?.subscription_plan ?? 'free') as PlanId) in PLANS
    ? (org?.subscription_plan ?? 'free') as PlanId
    : 'free'

  const isActive =
    planId !== 'free' && ACTIVE_STATUSES.includes(org?.subscription_status ?? '')

  if (opts.isPlatformAdmin) {
    return { planId, isActive: true, maxUsers: UNLIMITED, maxDocs: UNLIMITED, maxCompanies: UNLIMITED }
  }

  const plan = PLANS[planId] ?? PLANS.free
  const extraUsers     = org?.extra_users_quantity ?? 0
  const extraDocs      = org?.extra_docs_quantity ?? 0
  const extraCompanies = org?.extra_companies_quantity ?? 0

  // An inactive plan falls back to the free allowance rather than to zero, so
  // an expired subscription keeps read access and the free tier's limits.
  if (!isActive) {
    return {
      planId,
      isActive: false,
      maxUsers: PLANS.free.users,
      maxDocs: PLANS.free.docsPerYear,
      maxCompanies: 1,
    }
  }

  return {
    planId,
    isActive: true,
    maxUsers: plan.users + extraUsers,
    maxDocs: plan.docsPerYear + extraDocs * ADDONS.extraDocs.docs,
    maxCompanies: PAID_BASE_COMPANIES + extraCompanies,
  }
}
