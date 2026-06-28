import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeHuella, buildRegistroAlta, buildQrUrl, nowWithOffset } from '@/lib/verifactu'
import { buildInvoicePdf } from '@/lib/invoice-pdf'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Issues a rectificative invoice (credit note / nota de abono) that fully
 * annuls a previously issued invoice: same lines with negated amounts,
 * referencing the original per Verifactu (FacturasRectificadas).
 */
export async function POST(req: NextRequest) {
  try {
    const { orgId, invoiceId } = await req.json()
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!orgId || !invoiceId) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    // ── Load original ───────────────────────────────────────
    const { data: orig } = await supabase.from('invoices').select('*').eq('id', invoiceId).eq('organization_id', orgId).single()
    if (!orig) return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 })
    if (orig.state !== 'issued') return NextResponse.json({ error: 'not_issued' }, { status: 422 })
    if (orig.kind === 'rectifying') return NextResponse.json({ error: 'already_rectificative' }, { status: 422 })

    const { data: existing } = await supabase.from('invoices').select('id').eq('rectifies_invoice_id', invoiceId).maybeSingle()
    if (existing) return NextResponse.json({ error: 'already_rectified' }, { status: 409 })

    const { data: origLines } = await supabase.from('invoice_lines').select('*').eq('invoice_id', invoiceId).order('position')

    // ── Negated amounts ─────────────────────────────────────
    const subtotal = round2(-Number(orig.subtotal))
    const taxAmount = round2(-Number(orig.tax_amount))
    const total = round2(-Number(orig.total))

    const issueDate = new Date().toISOString().slice(0, 10)
    const series = 'R'
    const year = parseInt(issueDate.split('-')[0], 10)

    const { data: number, error: numErr } = await supabase.rpc('next_invoice_number', { p_org: orgId, p_series: series, p_year: year })
    if (numErr || number == null) return NextResponse.json({ error: 'numbering_failed', detail: numErr?.message }, { status: 403 })
    const fullNumber = `${series}-${year}-${String(number).padStart(4, '0')}`

    // ── Huella chain ────────────────────────────────────────
    const { data: prev } = await supabase.from('invoices')
      .select('huella').eq('organization_id', orgId).eq('state', 'issued')
      .not('huella', 'is', null).order('issued_at', { ascending: false }).limit(1).maybeSingle()
    const previousHuella = prev?.huella ?? ''
    const generatedAt = nowWithOffset()

    const registroInput = {
      issuerNif: orig.issuer_cif!.trim(),
      fullNumber, issueDate, kind: 'rectifying' as const,
      cuotaTotal: taxAmount, importeTotal: total,
      previousHuella, generatedAt,
    }
    const huella = computeHuella(registroInput)
    const registroAlta = buildRegistroAlta({
      ...registroInput,
      issuerName: orig.issuer_name ?? '',
      clientNif: orig.client_cif, clientName: orig.client_name,
      rectified: { issuerNif: orig.issuer_cif!.trim(), fullNumber: orig.full_number!, issueDate: orig.issue_date! },
    })
    const qrUrl = buildQrUrl(orig.issuer_cif!.trim(), fullNumber, issueDate, total)

    // ── Insert rectificative invoice ────────────────────────
    const { data: rec, error: invErr } = await supabase.from('invoices').insert({
      organization_id: orgId,
      client_company_id: orig.client_company_id,
      series, number, full_number: fullNumber,
      kind: 'rectifying', state: 'issued',
      issue_date: issueDate, operation_date: issueDate,
      subtotal, tax_amount: taxAmount, total,
      issuer_name: orig.issuer_name, issuer_cif: orig.issuer_cif, issuer_address: orig.issuer_address,
      issuer_city: orig.issuer_city, issuer_postal_code: orig.issuer_postal_code, issuer_province: orig.issuer_province,
      client_name: orig.client_name, client_cif: orig.client_cif, client_address: orig.client_address,
      client_city: orig.client_city, client_postal_code: orig.client_postal_code, client_province: orig.client_province,
      notes: `Rectificativa por anulación de ${orig.full_number}`,
      huella, huella_anterior: previousHuella || null,
      qr_url: qrUrl, registro_alta: registroAlta,
      verifactu_status: 'generated', issued_at: generatedAt,
      payment_status: 'pending', rectifies_invoice_id: invoiceId,
      created_by: user.id,
    }).select('id, full_number').single()
    if (invErr || !rec) return NextResponse.json({ error: 'insert_failed', detail: invErr?.message }, { status: 400 })

    // ── Negated lines ───────────────────────────────────────
    const negLines = (origLines ?? []).map((l, idx) => ({
      invoice_id: rec.id, product_id: l.product_id, description: l.description,
      quantity: -Number(l.quantity), unit_price: Number(l.unit_price), tax_rate: Number(l.tax_rate),
      discount_pct: Number(l.discount_pct),
      line_subtotal: round2(-Number(l.line_subtotal)), line_tax: round2(-Number(l.line_tax)), line_total: round2(-Number(l.line_total)),
      position: idx,
    }))
    if (negLines.length) await supabase.from('invoice_lines').insert(negLines)

    // ── Restore stock for tracked products ──────────────────
    for (const l of origLines ?? []) {
      if (!l.product_id) continue
      const { data: prod } = await supabase.from('products').select('track_stock, stock_qty').eq('id', l.product_id).single()
      if (prod?.track_stock) {
        await supabase.from('products').update({ stock_qty: round2(Number(prod.stock_qty) + Number(l.quantity)) }).eq('id', l.product_id)
      }
    }

    // ── Mark original as cancelled (payment status) ─────────
    await supabase.from('invoices').update({ payment_status: 'cancelled' }).eq('id', invoiceId)

    // ── PDF + archive (best-effort) ─────────────────────────
    try {
      const pdfBytes = await buildInvoicePdf({
        fullNumber, issueDate,
        issuer: { name: orig.issuer_name ?? '', cif: orig.issuer_cif, address: orig.issuer_address, postalCode: orig.issuer_postal_code, city: orig.issuer_city, province: orig.issuer_province },
        client: { name: orig.client_name ?? '', cif: orig.client_cif, address: orig.client_address, postalCode: orig.client_postal_code, city: orig.client_city, province: orig.client_province },
        lines: negLines.map(l => ({ description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, line_total: l.line_total })),
        subtotal, taxAmount, total, notes: `Rectificativa por anulación de ${orig.full_number}`, huella, qrUrl,
      })
      const storagePath = `${orgId}/invoices/${rec.id}.pdf`
      const { error: upErr } = await supabase.storage.from('documents').upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })
      if (!upErr) {
        const { data: doc } = await supabase.from('documents').insert({
          organization_id: orgId, company_id: orig.client_company_id, uploaded_by: user.id,
          document_number: fullNumber, document_type: 'invoice_issued', status: 'cancelled',
          total, currency: 'EUR', issue_date: issueDate,
          file_url: storagePath, file_name: `${fullNumber}.pdf`, file_size: pdfBytes.length, file_type: 'application/pdf',
        }).select('id').single()
        if (doc) await supabase.from('invoices').update({ document_id: doc.id }).eq('id', rec.id)
      }
    } catch (pdfErr) {
      console.warn('[invoices/rectify] PDF archival failed (non-fatal):', pdfErr)
    }

    return NextResponse.json({ success: true, id: rec.id, fullNumber: rec.full_number })
  } catch (err) {
    console.error('[invoices/rectify] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
