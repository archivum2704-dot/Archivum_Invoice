import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { archiveQuoteToLibrary } from '@/lib/quote-archive'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

const round2 = (n: number) => Math.round(n * 100) / 100

interface LineInput {
  productId?: string | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  /** Lista L10. Obligatoria en una línea exenta; nula en cualquier otra. */
  exemptionCause?: string | null
  discountPct?: number
}

/** Create or update a quote (presupuesto). Pass `id` to edit an existing draft/sent quote. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id = null, orgId, clientCompanyId = null, series = 'PRE',
      issueDate = null, validUntil = null, notes = null,
      retentionPct = 0, discountPct = 0, status = 'sent',
      lines = [] as LineInput[],
    } = body

    const supabase: any = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    const finalize = status === 'sent' || status === 'accepted'
    const validLines = (Array.isArray(lines) ? lines : []).filter(l => l?.description?.trim())
    if (finalize && !clientCompanyId) return NextResponse.json({ error: 'client_required' }, { status: 400 })
    if (finalize && validLines.length === 0) return NextResponse.json({ error: 'no_lines' }, { status: 400 })

    // Una línea exenta necesita su causa (lista L10). Se exige aquí, al cerrar
    // el presupuesto, y no al convertirlo en factura: si se dejara para
    // entonces, el usuario descubriría el problema con el presupuesto ya
    // enviado al cliente y aceptado.
    if (finalize && validLines.some(l => (Number(l.taxRate) || 0) === 0 && !l.exemptionCause?.trim())) {
      return NextResponse.json({ error: 'exemption_cause_required' }, { status: 400 })
    }

    // Snapshots
    const { data: org } = await supabase
      .from('organizations')
      .select('name, cif, address, city, postal_code, province, logo_url')
      .eq('id', orgId).single()
    let client: Record<string, string | null> | null = null
    if (clientCompanyId) {
      const { data } = await supabase
        .from('companies')
        .select('name, cif, address, city, postal_code, province')
        .eq('id', clientCompanyId).single()
      client = data ?? null
    }

    // Totals (per-line gross, then global discount reducing base + tax)
    let grossBase = 0, grossTax = 0
    const computedLines = validLines.map((l, idx) => {
      const qty = Number(l.quantity) || 0
      const price = Number(l.unitPrice) || 0
      const rate = Number(l.taxRate) || 0
      // Una línea exenta sin causa no se puede convertir después en factura,
      // así que se rechaza aquí y no al facturar, cuando ya es tarde.
      const cause = rate === 0 ? (l.exemptionCause?.trim() || null) : null
      const disc = Number(l.discountPct) || 0
      const base = round2(qty * price * (1 - disc / 100))
      const tax = round2(base * rate / 100)
      grossBase += base; grossTax += tax
      return {
        product_id: l.productId ?? null, description: l.description.trim(),
        quantity: qty, unit_price: price, tax_rate: rate, discount_pct: disc,
        exemption_cause: cause,
        line_subtotal: base, line_tax: tax, line_total: round2(base + tax), position: idx,
      }
    })
    const subtotal = round2(grossBase)
    const discPct = Number(discountPct) || 0
    const discountAmount = round2(subtotal * discPct / 100)
    const netBase = round2(subtotal - discountAmount)
    const taxAmount = round2(grossTax * (1 - discPct / 100))
    const retPct = Number(retentionPct) || 0
    const retentionAmount = round2(netBase * retPct / 100)
    const total = round2(netBase + taxAmount - retentionAmount)

    // Assign a number when finalizing (if not already numbered)
    let fullNumber: string | null = null
    let number: number | null = null
    if (finalize) {
      const existing = id ? (await supabase.from('quotes').select('full_number, number').eq('id', id).single()).data : null
      if (existing?.full_number) {
        fullNumber = existing.full_number; number = existing.number
      } else {
        const year = parseInt((issueDate ?? new Date().toISOString()).split('-')[0], 10)
        const { data: n, error: numErr } = await supabase.rpc('next_quote_number', { p_org: orgId, p_series: series, p_year: year })
        if (numErr || n == null) return NextResponse.json({ error: 'numbering_failed', detail: numErr?.message }, { status: 403 })
        number = n as number
        fullNumber = `${series}-${year}-${String(number).padStart(4, '0')}`
      }
    }

    const row = {
      organization_id: orgId, client_company_id: clientCompanyId || null,
      series, number, full_number: fullNumber, status,
      issue_date: issueDate || null, valid_until: validUntil || null,
      subtotal, discount_pct: discPct || null, discount_amount: discountAmount,
      tax_amount: taxAmount, retention_pct: retPct || null, retention_amount: retentionAmount, total,
      issuer_name: org?.name ?? null, issuer_cif: org?.cif ?? null, issuer_address: org?.address ?? null,
      issuer_city: org?.city ?? null, issuer_postal_code: org?.postal_code ?? null, issuer_province: org?.province ?? null,
      issuer_logo_url: org?.logo_url ?? null,
      client_name: client?.name ?? null, client_cif: client?.cif ?? null, client_address: client?.address ?? null,
      client_city: client?.city ?? null, client_postal_code: client?.postal_code ?? null, client_province: client?.province ?? null,
      notes: notes?.trim?.() || null,
    }

    let quoteId = id as string | null
    if (id) {
      const { error: upErr } = await supabase.from('quotes').update(row).eq('id', id)
      if (upErr) return NextResponse.json({ error: 'update_failed', detail: upErr.message }, { status: 400 })
      await supabase.from('quote_lines').delete().eq('quote_id', id)
    } else {
      const { data: created, error: insErr } = await supabase
        .from('quotes').insert({ ...row, created_by: user.id }).select('id').single()
      if (insErr || !created) return NextResponse.json({ error: 'insert_failed', detail: insErr?.message }, { status: 400 })
      quoteId = created.id
    }

    if (computedLines.length > 0 && quoteId) {
      const { error: linesErr } = await supabase
        .from('quote_lines').insert(computedLines.map(l => ({ ...l, quote_id: quoteId })))
      if (linesErr) return NextResponse.json({ error: 'lines_failed', detail: linesErr.message }, { status: 400 })
    }

    // ── Delivery note ────────────────────────────────────────────────────
    // A finalized quote opens an albarán, and that albarán is what can later
    // be billed. While it is still open it tracks the quote, so editing the
    // quote does not leave the note describing different work; once it has
    // been invoiced it is frozen.
    let deliveryNoteId: string | null = null
    if (finalize && quoteId) {
      const { data: existingNote } = await supabase
        .from('quotes').select('id, status').eq('source_quote_id', quoteId).maybeSingle()

      const noteRow = {
        ...row,
        kind: 'delivery_note',
        status: 'open',
        source_quote_id: quoteId,
      }

      if (!existingNote) {
        const year = parseInt((issueDate ?? new Date().toISOString()).split('-')[0], 10)
        const { data: n, error: numErr } = await supabase
          .rpc('next_quote_number', { p_org: orgId, p_series: 'ALB', p_year: year })
        if (numErr || n == null) {
          return NextResponse.json({ error: 'numbering_failed', detail: numErr?.message }, { status: 403 })
        }
        const noteNumber = n as number
        const { data: note, error: noteErr } = await supabase.from('quotes').insert({
          ...noteRow,
          series: 'ALB', number: noteNumber,
          full_number: `ALB-${year}-${String(noteNumber).padStart(4, '0')}`,
          created_by: user.id,
        }).select('id').single()
        if (noteErr || !note) {
          return NextResponse.json({ error: 'delivery_note_failed', detail: noteErr?.message }, { status: 400 })
        }
        deliveryNoteId = note.id
      } else if (existingNote.status === 'open') {
        const { series: _s, number: _n, full_number: _f, ...syncable } = noteRow as Record<string, unknown>
        await supabase.from('quotes').update(syncable).eq('id', existingNote.id)
        await supabase.from('quote_lines').delete().eq('quote_id', existingNote.id)
        deliveryNoteId = existingNote.id
      }

      if (deliveryNoteId && computedLines.length > 0) {
        await supabase.from('quote_lines')
          .insert(computedLines.map(l => ({ ...l, quote_id: deliveryNoteId })))
      }
    }

    // Archivado en la Biblioteca, best-effort. El presupuesto y su albarán se
    // archivan por igual: antes solo se archivaba el presupuesto y el albarán
    // se quedaba sin copia, que es por lo que su filtro no encontraba nada.
    if (finalize && quoteId && org) {
      const archiver = await createServerSupabase(true)
      await archiveQuoteToLibrary(archiver, { quoteId, orgId, uploadedBy: user.id })
      if (deliveryNoteId) {
        await archiveQuoteToLibrary(archiver, { quoteId: deliveryNoteId, orgId, uploadedBy: user.id })
      }
    }

    return NextResponse.json({ success: true, id: quoteId, fullNumber, deliveryNoteId })
  } catch (err) {
    console.error('[quotes] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
