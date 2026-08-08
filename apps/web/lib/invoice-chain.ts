import type { SupabaseClient } from '@supabase/supabase-js'
import { nowWithOffset } from '@/lib/verifactu'

/** What the caller needs in order to build the invoice row. */
export interface ChainLink {
  /** The huella of the organization's last issued invoice; '' for the first. */
  previousHuella: string
  /** FechaHoraHusoGenRegistro for this attempt. */
  generatedAt: string
}

// Two enforcement points now: the index on invoices, and the one on the shared
// chain table that also covers anulación records. Either firing means the same
// thing — someone took this link first.
const CHAIN_CONFLICTS = ['uq_invoices_chain', 'uq_chain_links_predecessor']
const MAX_ATTEMPTS = 4

/**
 * The current head of an organization's chain.
 *
 * Alta and anulación records share one chain, so the head cannot be read from
 * `invoices` alone: an annulment generated after the last invoice is the head.
 */
export async function readChainHead(db: any, orgId: string): Promise<string> {
  const { data } = await db.rpc('verifactu_chain_head', { p_org: orgId })
  const head = Array.isArray(data) ? data[0] : data
  return head?.huella ?? ''
}

/**
 * Insert an invoice chained onto the organization's last huella, retrying if
 * another invoice takes the same link first.
 *
 * The chain head has to be read before the row can be built, and the read and
 * the insert are separate round trips, so two invoices issued at the same
 * moment can both chain onto the same predecessor. The uq_invoices_chain index
 * rejects the second one; here we re-read the head, rebuild the row against it
 * and try again.
 *
 * `build` is called once per attempt and must recompute the huella and the
 * registro de alta from the link it is given — that is the whole point of
 * retrying. The invoice number is *not* re-taken: the caller has already
 * consumed it and reusing it keeps the series free of gaps, which the AEAT
 * requires.
 */
/**
 * Whether an error is another writer having taken this link.
 *
 * PostgREST puts the index name in the message; details carries it too on some
 * versions, so both are checked.
 */
export function isChainConflict(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (error?.code !== '23505') return false
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`
  return CHAIN_CONFLICTS.some(name => text.includes(name))
}

export async function insertChainedInvoice(
  supabase: SupabaseClient,
  orgId: string,
  build: (link: ChainLink) => Record<string, unknown>,
): Promise<{ id: string; full_number: string } | { error: string }> {
  const db = supabase as any

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const previousHuella = await readChainHead(db, orgId)
    const generatedAt = nowWithOffset()
    const row = build({ previousHuella, generatedAt })

    const { data, error } = await db.from('invoices').insert(row).select('id, full_number').single()
    if (!error && data) {
      // Join the shared chain. If this link was taken between the insert and
      // here, the unique index rejects it and the invoice is rolled back by
      // hand: a chained invoice that is not on the chain would be worse than
      // no invoice, and there is no transaction spanning the two calls.
      const { error: linkErr } = await db.from('verifactu_chain_links').insert({
        organization_id: orgId, kind: 'alta', invoice_id: data.id,
        full_number: data.full_number, issue_date: (row as any).issue_date,
        huella: (row as any).huella, huella_anterior: previousHuella || null,
        generated_at: generatedAt,
      })
      if (!linkErr) return { id: data.id, full_number: data.full_number }

      await db.from('invoices').delete().eq('id', data.id)
      if (!isChainConflict(linkErr)) return { error: linkErr.message }
      console.warn(`[invoice-chain] link taken at chain table, retrying (${attempt}/${MAX_ATTEMPTS})`)
      continue
    }

    if (!isChainConflict(error)) return { error: error?.message ?? 'insert_failed' }

    // Someone else took this link. Read the advanced head and rebuild.
    console.warn(`[invoice-chain] link taken, retrying (${attempt}/${MAX_ATTEMPTS})`)
  }

  return { error: 'La cadena Verifactu está siendo usada por otra factura. Inténtalo de nuevo.' }
}
