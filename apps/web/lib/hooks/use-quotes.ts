import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { ALL_ORGS_ID } from '@/lib/context/organization-context'

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted' | 'open'

/**
 * Quotes and delivery notes share a table — they carry the same client, lines
 * and totals — and are told apart by this. Any list that means one of them
 * must filter on it, or it shows both.
 */
export type QuoteKind = 'quote' | 'delivery_note'

export type Quote = {
  id: string
  organization_id: string
  client_company_id: string | null
  series: string
  number: number | null
  full_number: string | null
  status: QuoteStatus
  issue_date: string | null
  valid_until: string | null
  currency: string
  subtotal: number
  discount_pct: number | null
  discount_amount: number
  tax_amount: number
  retention_pct: number | null
  retention_amount: number
  total: number
  issuer_name: string | null
  issuer_cif: string | null
  issuer_address: string | null
  issuer_city: string | null
  issuer_postal_code: string | null
  issuer_province: string | null
  issuer_logo_url: string | null
  client_name: string | null
  client_cif: string | null
  client_address: string | null
  client_city: string | null
  client_postal_code: string | null
  client_province: string | null
  notes: string | null
  kind: QuoteKind
  source_quote_id: string | null
  converted_invoice_id: string | null
  document_id: string | null
  created_at: string
  client: { name: string; cif: string | null } | null
}

export type QuoteLine = {
  id: string
  quote_id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  discount_pct: number
  line_subtotal: number
  line_tax: number
  line_total: number
  position: number
}

async function fetchQuotes(orgId: string, kind: QuoteKind): Promise<Quote[]> {
  const supabase: any = createClient()
  let query = supabase
    .from('quotes').select('*, client:companies!client_company_id(name, cif)')
    .eq('kind', kind)
  if (orgId !== ALL_ORGS_ID) query = query.eq('organization_id', orgId)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Quote[]
}

/** `kind` is required so a caller cannot forget it and list both. */
export function useQuotes(orgId: string | null, kind: QuoteKind) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['quotes', orgId, kind] : null,
    () => fetchQuotes(orgId!, kind),
    { revalidateOnFocus: false },
  )
  return { quotes: data ?? [], loading: isLoading, error, mutate }
}

export async function fetchQuoteWithLines(id: string): Promise<{ quote: Quote; lines: QuoteLine[] } | null> {
  const supabase: any = createClient()
  const { data: quote } = await supabase
    .from('quotes').select('*, client:companies!client_company_id(name, cif)').eq('id', id).single()
  if (!quote) return null
  const { data: lines } = await supabase
    .from('quote_lines').select('*').eq('quote_id', id).order('position')
  return { quote: quote as unknown as Quote, lines: (lines ?? []) as unknown as QuoteLine[] }
}
