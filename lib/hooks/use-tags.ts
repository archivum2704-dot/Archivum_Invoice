import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

interface Tag {
  id: string
  name: string
  color: string | null
  created_at: string
}

async function fetchTags(orgId: string | null): Promise<Tag[]> {
  if (!orgId) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export function useTags(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['tags', orgId] : null,
    () => fetchTags(orgId),
    { revalidateOnFocus: false }
  )

  return {
    tags: data || [],
    loading: isLoading,
    error,
    mutate,
  }
}
