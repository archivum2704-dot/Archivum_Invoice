import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

export type Folder = Database['public']['Tables']['folders']['Row']

async function fetchFolders(orgId: string): Promise<Folder[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('organization_id', orgId)
    .order('name', { ascending: true })
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
