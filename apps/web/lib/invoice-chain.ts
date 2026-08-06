import type { SupabaseClient } from '@supabase/supabase-js'
import { nowWithOffset } from '@/lib/verifactu'

/** What the caller needs in order to build the invoice row. */
export interface ChainLink {
  /** The huella of the organization's last issued invoice; '' for the first. */
  previousHuella: string
  /** FechaHoraHusoGenRegistro for this attempt. */
  generatedAt: string
}

const CHAIN_CONFLICT = 'uq_invoices_chain'
const MAX_ATTEMPTS = 4

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
export async function insertChainedInvoice(
  supabase: SupabaseClient,
  orgId: string,
  build: (link: ChainLink) => Record<string, unknown>,
): Promise<{ id: string; full_number: string } | { error: string }> {
  const db = supabase as any

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { data: prev } = await db
      .from('invoices').select('huella')
      .eq('organization_id', orgId).eq('state', 'issued')
      .not('huella', 'is', null)
      .order('issued_at', { ascending: false }).limit(1).maybeSingle()

    const row = build({ previousHuella: prev?.huella ?? '', generatedAt: nowWithOffset() })

    const { data, error } = await db.from('invoices').insert(row).select('id, full_number').single()
    if (!error && data) return { id: data.id, full_number: data.full_number }

    // PostgREST puts the index name in the message; details carries it too on
    // some versions, so both are checked.
    const isChainConflict =
      error?.code === '23505' &&
      `${error?.message ?? ''} ${error?.details ?? ''}`.includes(CHAIN_CONFLICT)
    if (!isChainConflict) return { error: error?.message ?? 'insert_failed' }

    // Someone else took this link. Read the advanced head and rebuild.
    console.warn(`[invoice-chain] link taken, retrying (${attempt}/${MAX_ATTEMPTS})`)
  }

  return { error: 'La cadena Verifactu está siendo usada por otra factura. Inténtalo de nuevo.' }
}
