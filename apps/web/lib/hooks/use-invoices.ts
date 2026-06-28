import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { ALL_ORGS_ID } from '@/lib/context/organization-context'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']

export type Invoice = InvoiceRow & {
  client: { name: string; cif: string | null } | null
}

async function fetchInvoices(orgId: string): Promise<Invoice[]> {
  const supabase = createClient()
  let query = supabase
    .from('invoices')
    .select('*, client:companies!client_company_id(name, cif)')
  if (orgId !== ALL_ORGS_ID) {
    query = query.eq('organization_id', orgId)
  }
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Invoice[]
}

export function useInvoices(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['invoices', orgId] : null,
    () => fetchInvoices(orgId!),
    { revalidateOnFocus: false },
  )
  return { invoices: data ?? [], loading: isLoading, error, mutate }
}
