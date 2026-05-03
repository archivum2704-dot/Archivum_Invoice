import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Company = Database['public']['Tables']['companies']['Row']

export type CompanyWithCount = Company & { doc_count: number }

async function fetchCompanies(orgId: string): Promise<CompanyWithCount[]> {
  const supabase = createClient()

  // Fetch companies + document counts in parallel
  const [{ data: companiesData, error: companiesErr }, { data: countsData, error: countsErr }] =
    await Promise.all([
      supabase
        .from('companies')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('documents')
        .select('company_id')
        .eq('organization_id', orgId)
        .not('company_id', 'is', null),
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
