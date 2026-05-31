import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { ALL_ORGS_ID } from '@/lib/context/organization-context'

export type Folder = Database['public']['Tables']['folders']['Row']

async function fetchFolders(orgId: string): Promise<Folder[]> {
  const supabase = createClient()
  let query = supabase.from('folders').select('*')
  if (orgId !== ALL_ORGS_ID) {
    query = query.eq('organization_id', orgId)
  }
  const { data, error } = await query.order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export function useFolders(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['folders', orgId] : null,
    () => fetchFolders(orgId!),
    { revalidateOnFocus: false },
  )

  return { folders: data ?? [], loading: isLoading, error, mutate }
}
