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

const MOCK_COMPANIES: Company[] = [
  {
    id: 'mock-co-1',
    name: 'Tech Solutions Iberia',
    cif: 'B12345678',
    sector: 'Consultoría IT',
    city: 'Madrid',
    total_invoiced: 45000.80,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'mock-co-2',
    name: 'Constructora del Norte',
    cif: 'A87654321',
    sector: 'Construcción',
    city: 'Bilbao',
    total_invoiced: 120500.25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

async function fetchCompanies(orgId: string | null): Promise<Company[]> {
  // DEMO MODE: Always return mock data immediately
  return MOCK_COMPANIES
}

export function useCompanies(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    ['companies', orgId],
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
