import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  cif: string
  sector: string | null
  city: string | null
  total_invoiced: number
  created_at: string
  updated_at: string
}

async function fetchCompanies(orgId: string | null): Promise<Company[]> {
  if (!orgId) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export function useCompanies(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['companies', orgId] : null,
    () => fetchCompanies(orgId),
    { revalidateOnFocus: false }
  )

  return {
    companies: data || [],
    loading: isLoading,
    error,
    mutate,
  }
}
