import useSWR from 'swr'

export interface BillingStatus {
  subscriptionStatus:  'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'paused'
  trialEndsAt:         string | null
  currentPeriodEnd:    string | null
  extraUsersQuantity:  number
  extraDocsQuantity:   number
  documentCount:       number
  memberCount:         number
  maxUsers:            number
  maxDocs:             number
  hasSubscription:     boolean
  hasCustomer:         boolean
  isAdmin:             boolean
}

async function fetchBilling(orgId: string): Promise<BillingStatus> {
  const res = await fetch(`/api/billing/status?orgId=${orgId}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function useBilling(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['billing', orgId] : null,
    () => fetchBilling(orgId!),
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  )
  return { billing: data ?? null, loading: isLoading, error, mutate }
}
