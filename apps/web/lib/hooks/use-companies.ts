import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Company = Database['public']['Tables']['companies']['Row']

async function fetchCompanies(orgId: string): Promise<Company[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}

export function useCompanies(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['companies', orgId] : null,
    () => fetchCompanies(orgId!),
    { revalidateOnFocus: false },
  )

  return { companies: data ?? [], loading: isLoading, error, mutate }
}
