import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { archiveQuoteToLibrary } from '@/lib/quote-archive'

/**
 * Open the delivery note for a quote that has none.
 *
 * Finalizing a quote normally opens its note automatically. This exists for
 * the ones that do not have it — quotes created before delivery notes existed,
 * or a quote whose note failed to open — so the flow can always be resumed
 * from the quote instead of leaving it with no way forward.
 */
export async function POST(req: NextRequest) {
  try {
    const { quoteId } = await req.json()
    if (!quoteId) return NextResponse.json({ error: 'missing_quote' }, { status: 400 })

    const supabase: any = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).single()
    if (!quote) return NextResponse.json({ error: 'quote_not_found' }, { status: 404 })
    if (quote.kind !== 'quote') return NextResponse.json({ error: 'not_a_quote' }, { status: 422 })
    if (quote.status === 'converted') return NextResponse.json({ error: 'already_billed' }, { status: 422 })

    const { data: existing } = await supabase
      .from('quotes').select('id').eq('source_quote_id', quoteId).maybeSingle()
    if (existing) return NextResponse.json({ success: true, id: existing.id, alreadyOpen: true })

    const { data: lines } = await supabase
      .from('quote_lines').select('*').eq('quote_id', quoteId).order('position')
    if (!lines || lines.length === 0) return NextResponse.json({ error: 'no_lines' }, { status: 400 })

    const year = parseInt((quote.issue_date ?? new Date().toISOString()).split('-')[0], 10)
    const { data: n, error: numErr } = await supabase
      .rpc('next_quote_number', { p_org: quote.organization_id, p_series: 'ALB', p_year: year })
    if (numErr || n == null) {
      return NextResponse.json({ error: 'numbering_failed', detail: numErr?.message }, { status: 403 })
    }

    // Everything but the quote's own identity carries over.
    const { id: _id, created_at: _c, updated_at: _u, document_id: _d,
            converted_invoice_id: _ci, series: _s, number: _n, full_number: _f,
            kind: _k, status: _st, source_quote_id: _sq, ...carried } = quote

    const { data: note, error: noteErr } = await supabase.from('quotes').insert({
      ...carried,
      kind: 'delivery_note',
      status: 'open',
      source_quote_id: quoteId,
      series: 'ALB',
      number: n,
      full_number: `ALB-${year}-${String(n).padStart(4, '0')}`,
      created_by: user.id,
    }).select('id, full_number').single()
    if (noteErr || !note) {
      return NextResponse.json({ error: 'insert_failed', detail: noteErr?.message }, { status: 400 })
    }

    const { error: linesErr } = await supabase.from('quote_lines').insert(
      lines.map((l: any) => {
        const { id: _lid, created_at: _lc, quote_id: _q, ...line } = l
        return { ...line, quote_id: note.id }
      }),
    )
    if (linesErr) {
      await supabase.from('quotes').delete().eq('id', note.id)
      return NextResponse.json({ error: 'lines_failed', detail: linesErr.message }, { status: 400 })
    }

    // El albarán se archiva igual que el presupuesto. Best-effort: si falla,
    // el albarán ya existe y eso es lo que cuenta.
    const archiver = await createServerSupabase(true)
    await archiveQuoteToLibrary(archiver, {
      quoteId: note.id, orgId: quote.organization_id, uploadedBy: user.id,
    })

    return NextResponse.json({ success: true, id: note.id, fullNumber: note.full_number })
  } catch (err) {
    console.error('[quotes/delivery-note] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
