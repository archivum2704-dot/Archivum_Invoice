import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { ALL_ORGS_ID } from '@/lib/context/organization-context'

type DocumentRow = Database['public']['Tables']['documents']['Row']

export type Document = DocumentRow & {
  company: { name: string; cif: string | null } | null
}

async function fetchDocuments(orgId: string): Promise<Document[]> {
  const supabase = createClient()
  let query = supabase
    .from('documents')
    .select('*, company:companies(name, cif)')
  // ALL_ORGS_ID: super admins see documents across every organization (RLS allows it)
  if (orgId !== ALL_ORGS_ID) {
    query = query.eq('organization_id', orgId)
  }
  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Document[]
}

export function useDocuments(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['documents', orgId] : null,
    () => fetchDocuments(orgId!),
    { revalidateOnFocus: false },
  )

  return { documents: data ?? [], loading: isLoading, error, mutate }
}
