import type { SupabaseClient } from '@supabase/supabase-js'
import { renderDocument } from '@/lib/document-render'
import { toEur } from '@/lib/currency'

/**
 * Archive a quote or a delivery note in the Biblioteca.
 *
 * Both live in the same table and differ only by `kind`, so they archive the
 * same way. Until now only quotes did: opening a delivery note left it with a
 * row and a number but nothing in the library, which is why the «Albarán»
 * filter matched nothing at all.
 *
 * The PDF is rebuilt from the stored row through the shared renderer, so the
 * archived copy, the download and the emailed attachment are the same document.
 *
 * **Best-effort by design.** Archiving must never be the reason a quote fails
 * to save or a delivery note fails to open — the record in `quotes` is the one
 * that matters, and the library copy is a convenience. Failures are logged and
 * swallowed, and the boolean is returned for callers that want to assert.
 */
export async function archiveQuoteToLibrary(
  /** Service-role client: storage uploads and the archival insert need it. */
  archiver: SupabaseClient,
  args: { quoteId: string; orgId: string; uploadedBy: string },
): Promise<boolean> {
  const db = archiver as any
  try {
    const { data: q } = await db.from('quotes')
      .select('id, kind, full_number, issue_date, total, client_company_id, currency, exchange_rate')
      .eq('id', args.quoteId).single()
    if (!q) return false

    const rendered = await renderDocument(archiver, 'quote', args.quoteId)
    if (!rendered) return false

    const isNote = q.kind === 'delivery_note'
    // Kept under quotes/ for both: it is where the mobile app already looks for
    // the PDF of either kind, and the id is unique across both.
    const storagePath = `${args.orgId}/quotes/${args.quoteId}.pdf`

    const { error: upErr } = await db.storage
      .from('documents')
      .upload(storagePath, rendered.bytes, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`)

    // Re-saving a quote or re-opening a note must not pile up rows in the
    // library. The existing document is updated when there is one.
    const { data: existing } = await db.from('quotes')
      .select('document_id').eq('id', args.quoteId).maybeSingle()

    const payload = {
      organization_id: args.orgId,
      company_id: q.client_company_id || null,
      document_number: q.full_number,
      document_type: isNote ? 'delivery_note' : 'quote',
      // Equivalente en euros, no el importe en la moneda del pedido: la
      // Biblioteca y el dashboard suman `documents.total` entre distintas
      // monedas como si todas fueran la misma.
      total: toEur(q.total, q.currency ?? 'EUR', q.exchange_rate),
      currency: 'EUR',
      issue_date: q.issue_date || null,
      file_url: storagePath,
      file_name: rendered.filename,
      file_size: rendered.bytes.length,
      file_type: 'application/pdf',
    }

    if (existing?.document_id) {
      const { error } = await db.from('documents').update(payload).eq('id', existing.document_id)
      if (error) throw new Error(error.message)
      return true
    }

    const { data: doc, error } = await db.from('documents')
      .insert({ ...payload, uploaded_by: args.uploadedBy, status: 'draft' })
      .select('id').single()
    if (error) throw new Error(error.message)
    if (doc) await db.from('quotes').update({ document_id: doc.id }).eq('id', args.quoteId)
    return true
  } catch (err) {
    console.error('[quote-archive] no se pudo archivar', args.quoteId, err)
    return false
  }
}
