import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { ALL_ORGS_ID } from '@/lib/context/organization-context'
import { quoteStatusLabel, quoteStatusStyle } from '@/lib/quote-status'

export type LinkedStatus = { label: string; style: string; href: string; source: 'quote' | 'delivery_note' | 'invoice' }

/**
 * The real status of a library document that is the archived copy of an
 * order, albarán or invoice.
 *
 * Those copies carry a `documents.status` of their own (draft/pending/…)
 * that nothing updates when the order is accepted or the albarán invoiced,
 * so Biblioteca and the dashboard said "Borrador" for something the Pedidos
 * screen called "Aceptado" (WEB-009). The status lives on the source record;
 * this reads it from there.
 */
async function fetchLinked(orgId: string): Promise<Map<string, LinkedStatus>> {
  const supabase: any = createClient()
  let qq = supabase.from('quotes').select('id, kind, status, document_id').not('document_id', 'is', null)
  let iq = supabase.from('invoices').select('*').not('document_id', 'is', null)
  if (orgId !== ALL_ORGS_ID) { qq = qq.eq('organization_id', orgId); iq = iq.eq('organization_id', orgId) }
  const [{ data: quotes }, { data: invoices }] = await Promise.all([qq, iq])

  const map = new Map<string, LinkedStatus>()
  for (const q of quotes ?? []) {
    map.set(q.document_id, {
      label: quoteStatusLabel(q.kind, q.status),
      style: quoteStatusStyle(q.kind, q.status),
      href: q.kind === 'delivery_note' ? `/albaranes/${q.id}` : `/pedidos/${q.id}`,
      source: q.kind,
    })
  }
  for (const i of invoices ?? []) {
    const paid = !!i.payment_date || i.payment_status === 'paid'
    const cancelled = i.payment_status === 'cancelled'
    const sent = !!i.sent_at
    map.set(i.document_id, {
      label: cancelled ? 'Rectificada' : paid ? 'Cobrada' : sent ? 'Enviada' : 'Pendiente de cobro',
      style: cancelled ? 'bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]'
        : paid ? 'bg-[var(--status-paid)]/10 text-[var(--status-paid)]'
        : sent ? 'bg-primary/10 text-primary'
        : 'bg-[var(--status-pending)]/10 text-[var(--status-pending)]',
      href: `/facturacion/${i.id}`,
      source: 'invoice',
    })
  }
  return map
}

export function useLinkedStatuses(orgId: string | null) {
  const { data, mutate } = useSWR(orgId ? ['linked-statuses', orgId] : null, () => fetchLinked(orgId!), { revalidateOnFocus: false })
  return { linked: data ?? new Map<string, LinkedStatus>(), mutateLinked: mutate }
}
