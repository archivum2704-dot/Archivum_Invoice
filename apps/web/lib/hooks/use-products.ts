import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { ALL_ORGS_ID } from '@/lib/context/organization-context'

export type Product = Database['public']['Tables']['products']['Row']

async function fetchProducts(orgId: string): Promise<Product[]> {
  const supabase = createClient()
  let query = supabase.from('products').select('*').eq('is_active', true)
  if (orgId !== ALL_ORGS_ID) {
    query = query.eq('organization_id', orgId)
  }
  const { data, error } = await query.order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export function useProducts(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['products', orgId] : null,
    () => fetchProducts(orgId!),
    { revalidateOnFocus: false },
  )
  return { products: data ?? [], loading: isLoading, error, mutate }
}
