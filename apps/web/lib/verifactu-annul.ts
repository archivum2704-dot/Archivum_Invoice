import type { SupabaseClient } from '@supabase/supabase-js'
import { buildRegistroAnulacion, computeHuellaAnulacion, nowWithOffset } from '@/lib/verifactu'
import { readChainHead, isChainConflict } from '@/lib/invoice-chain'

/**
 * Annulling an alta record (art. 11 RD 1007/2023).
 *
 * This is for a record generated **in error** — a duplicate, an invoice
 * expedited by mistake. It is not the way to undo a correct invoice whose
 * contents need changing: that is a rectificativa, and the two are different
 * instruments with different consequences.
 *
 * An anulación takes its own link on the same chain as the alta records, which
 * is why it goes through the shared chain table rather than reading the last
 * invoice.
 */

export type AnnulResult =
  | { id: string; huella: string }
  | { error: string; code?: string }

const MAX_ATTEMPTS = 4

export async function annulInvoiceRecord(
  supabase: SupabaseClient,
  userId: string,
  args: { orgId: string; invoiceId: string; reason?: string | null },
): Promise<AnnulResult> {
  const db = supabase as any

  const { data: invoice } = await db
    .from('invoices')
    .select('id, organization_id, full_number, issue_date, issuer_cif, state, verifactu_status')
    .eq('id', args.invoiceId).single()

  if (!invoice) return { error: 'Factura no encontrada', code: 'not_found' }
  if (invoice.organization_id !== args.orgId) return { error: 'Factura de otra organización', code: 'wrong_org' }
  if (invoice.state !== 'issued') return { error: 'Solo se anula el registro de una factura emitida', code: 'not_issued' }
  if (!invoice.issuer_cif?.trim()) return { error: 'La factura no tiene NIF de emisor', code: 'no_nif' }

  const { data: existing } = await db
    .from('verifactu_annulments').select('id').eq('invoice_id', args.invoiceId).maybeSingle()
  if (existing) return { error: 'El registro de esta factura ya está anulado', code: 'already_annulled' }

  // A rectificativa and an anulación are alternatives, never both: one says the
  // invoice was wrong, the other that it should never have existed.
  const { data: rectified } = await db
    .from('invoices').select('id, full_number').eq('rectifies_invoice_id', args.invoiceId).maybeSingle()
  if (rectified) {
    return {
      error: `Esta factura ya se rectificó con ${rectified.full_number ?? ''}. Una factura rectificada no se anula además.`,
      code: 'already_rectified',
    }
  }

  // Nothing was ever sent to the AEAT, so the annulment must say so: it is
  // annulling a record the Agencia has no copy of.
  const sinRegistroPrevio = invoice.verifactu_status !== 'sent'

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const previousHuella = await readChainHead(db, args.orgId)
    const generatedAt = nowWithOffset()

    const input = {
      issuerNif: invoice.issuer_cif.trim(),
      annulledFullNumber: invoice.full_number,
      annulledIssueDate: invoice.issue_date,
      previousHuella,
      generatedAt,
    }
    const huella = computeHuellaAnulacion(input)
    const registro = buildRegistroAnulacion({ ...input, installationId: args.orgId, sinRegistroPrevio })

    const { data: annulment, error: insErr } = await db.from('verifactu_annulments').insert({
      organization_id: args.orgId,
      invoice_id: invoice.id,
      issuer_nif: input.issuerNif,
      annulled_full_number: input.annulledFullNumber,
      annulled_issue_date: input.annulledIssueDate,
      reason: args.reason?.trim() || null,
      huella,
      huella_anterior: previousHuella || null,
      registro_anulacion: registro,
      generated_at: generatedAt,
      created_by: userId,
    }).select('id').single()

    if (insErr || !annulment) return { error: insErr?.message ?? 'insert_failed' }

    const { error: linkErr } = await db.from('verifactu_chain_links').insert({
      organization_id: args.orgId, kind: 'anulacion', annulment_id: annulment.id,
      invoice_id: invoice.id, full_number: invoice.full_number, issue_date: invoice.issue_date,
      huella, huella_anterior: previousHuella || null, generated_at: generatedAt,
    })

    if (!linkErr) {
      // The invoice keeps its own record — an annulled record is not a deleted
      // one — but stops being a live document.
      await db.from('invoices').update({ state: 'cancelled' }).eq('id', invoice.id)
      return { id: annulment.id, huella }
    }

    // Someone took this link first. The annulment is void: delete it via the
    // service role, which the immutability trigger does not exempt — so this
    // uses a direct delete before the record is considered to exist.
    await db.from('verifactu_annulments').delete().eq('id', annulment.id)
    if (!isChainConflict(linkErr)) return { error: linkErr.message }
    console.warn(`[verifactu-annul] link taken, retrying (${attempt}/${MAX_ATTEMPTS})`)
  }

  return { error: 'La cadena Verifactu está ocupada. Inténtalo de nuevo.', code: 'chain_busy' }
}
