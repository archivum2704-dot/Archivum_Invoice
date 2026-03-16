import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

interface Document {
  id: string
  document_number: string
  document_type: 'invoice' | 'receipt' | 'report' | 'contract'
  date: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  total_amount: number
  company_id: string
  created_at: string
  updated_at: string
}

async function fetchDocuments(orgId: string | null): Promise<Document[]> {
  if (!orgId) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export function useDocuments(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['documents', orgId] : null,
    () => fetchDocuments(orgId),
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  return {
    documents: data || [],
    loading: isLoading,
    error,
    mutate,
  }
}
