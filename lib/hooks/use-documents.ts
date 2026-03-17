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

const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'fac-001',
    document_number: 'FAC-2024-001',
    document_type: 'invoice',
    date: new Date().toISOString(),
    status: 'paid',
    total_amount: 1250.50,
    company_id: 'mock-co-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'rep-001',
    document_number: 'REP-2024-042',
    document_type: 'report',
    date: new Date().toISOString(),
    status: 'sent',
    total_amount: 0,
    company_id: 'mock-co-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'rec-001',
    document_number: 'REC-2024-128',
    document_type: 'receipt',
    date: new Date().toISOString(),
    status: 'draft',
    total_amount: 45.00,
    company_id: 'mock-co-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

async function fetchDocuments(orgId: string | null): Promise<Document[]> {
  // DEMO MODE: Always return mock data immediately
  return MOCK_DOCUMENTS
}

export function useDocuments(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    ['documents', orgId],
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
