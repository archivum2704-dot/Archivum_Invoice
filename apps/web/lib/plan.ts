import type { Database } from '@/lib/supabase/types'

type Org = Database['public']['Tables']['organizations']['Row']

/** Statuses that revoke access to paid features even on a non-free plan. */
const INACTIVE_STATUSES = ['canceled', 'unpaid', 'incomplete']

/**
 * Whether an organization is on an active paid plan.
 * Paid features (inventory, invoicing) are gated on this.
 * Mirrors the SQL helper `public.org_has_paid_plan(org_id)`.
 */
export function isPaidPlan(org: Pick<Org, 'subscription_plan' | 'subscription_status'> | null | undefined): boolean {
  if (!org) return false
  if (org.subscription_plan === 'free' || !org.subscription_plan) return false
  return !INACTIVE_STATUSES.includes(org.subscription_status ?? '')
}
