import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { ALL_ORGS_ID } from '@/lib/context/organization-context'

type Company = Database['public']['Tables']['companies']['Row']

export type CompanyWithCount = Company & { doc_count: number }

async function fetchCompanies(orgId: string): Promise<CompanyWithCount[]> {
  const supabase = createClient()

  // Build queries — when viewing all orgs (super admin), skip the org filter
  let companiesQuery = supabase.from('companies').select('*').eq('is_active', true)
  let countsQuery = supabase.from('documents').select('company_id').not('company_id', 'is', null)
  if (orgId !== ALL_ORGS_ID) {
    companiesQuery = companiesQuery.eq('organization_id', orgId)
    countsQuery = countsQuery.eq('organization_id', orgId)
  }

  // Fetch companies + document counts in parallel
  const [{ data: companiesData, error: companiesErr }, { data: countsData, error: countsErr }] =
    await Promise.all([
      companiesQuery.order('name'),
      countsQuery,
    ])

  if (companiesErr) throw companiesErr

  // Build a count map: company_id → number of docs
  const countMap: Record<string, number> = {}
  for (const row of countsData ?? []) {
    if (row.company_id) countMap[row.company_id] = (countMap[row.company_id] ?? 0) + 1
  }

  return (companiesData ?? []).map(c => ({ ...c, doc_count: countMap[c.id] ?? 0 }))
}

export function useCompanies(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['companies', orgId] : null,
    () => fetchCompanies(orgId!),
    { revalidateOnFocus: false },
  )

  return { companies: data ?? [], loading: isLoading, error, mutate }
}
