import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { computeHuella, buildRegistroAlta, buildQrUrl } from '@/lib/verifactu'
import { insertChainedInvoice } from '@/lib/invoice-chain'
import { buildInvoicePdf } from '@/lib/invoice-pdf'
import { toEur } from '@/lib/currency'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Issues a rectificative invoice (credit note / nota de abono) that fully
 * annuls a previously issued invoice: same lines with negated amounts,
 * referencing the original per Verifactu (FacturasRectificadas).
 */
export async function POST(req: NextRequest) {
  try {
    const { orgId, invoiceId } = await req.json()
    const supabase = await getApiClient(req)
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
    const retentionAmount = round2(-Number(orig.retention_amount ?? 0))
    const total = round2(-Number(orig.total))

    const issueDate = new Date().toISOString().slice(0, 10)
    const series = 'R'
    const year = parseInt(issueDate.split('-')[0], 10)

    const { data: number, error: numErr } = await supabase.rpc('next_invoice_number', { p_org: orgId, p_series: series, p_year: year })
    if (numErr || number == null) return NextResponse.json({ error: 'numbering_failed', detail: numErr?.message }, { status: 403 })
    const fullNumber = `${series}-${year}-${String(number).padStart(4, '0')}`

    // ── Huella chain ────────────────────────────────────────
    // A rectificativa joins the same chain as an ordinary invoice, so it takes
    // its link the same way: the insert claims it, and a clash with a
    // concurrent issue is retried against the advanced head.
    // La rectificativa hereda la moneda de la factura que anula: son el mismo
    // importe en negativo, así que el mismo tipo de cambio sigue valiendo. El
    // registro que va a la AEAT, como siempre, se convierte a euros aparte.
    const currency: string = orig.currency ?? 'EUR'
    const exchangeRate: number | null = orig.exchange_rate ?? null
    const eurTaxAmount = toEur(taxAmount, currency, exchangeRate)
    const eurTotal = toEur(total, currency, exchangeRate)
    const qrUrl = buildQrUrl(orig.issuer_cif!.trim(), fullNumber, issueDate, eurTotal)
    // Captured from the attempt that succeeded, for the PDF below.
    let huella = ''

    const chained = await insertChainedInvoice(supabase, orgId, ({ previousHuella, generatedAt }) => {
      const registroInput = {
        issuerNif: orig.issuer_cif!.trim(),
        fullNumber, issueDate, kind: 'rectifying' as const,
        cuotaTotal: eurTaxAmount, importeTotal: eurTotal,
        previousHuella, generatedAt,
      }
      const registroAlta = buildRegistroAlta({
        ...registroInput,
        issuerName: orig.issuer_name ?? '',
        client: {
          name: orig.client_name, id: orig.client_cif,
          countryCode: orig.client_country_code, idType: orig.client_tax_id_type,
        },
        installationId: orgId,
        notes: `Rectificativa por anulación de ${orig.full_number}`,
        // Negated, like the lines themselves: 'por diferencias' declares the
        // correction, so the desglose carries the amounts being taken back.
        lines: (origLines ?? []).map((l: any) => ({
          description: l.description,
          taxRate: Number(l.tax_rate),
          base: toEur(round2(-Number(l.line_subtotal)), currency, exchangeRate),
          cuota: toEur(round2(-Number(l.line_tax)), currency, exchangeRate),
          exemptionCause: l.exemption_cause,
        })),
        rectified: { issuerNif: orig.issuer_cif!.trim(), fullNumber: orig.full_number!, issueDate: orig.issue_date! },
      })
      return {
        organization_id: orgId,
        client_company_id: orig.client_company_id,
        series, number, full_number: fullNumber,
        // Created as draft so the negated lines can be inserted; promoted to
        // 'issued' below (line inserts are rejected once the parent is 'issued').
        kind: 'rectifying', state: 'draft',
        issue_date: issueDate, operation_date: issueDate,
        currency, exchange_rate: exchangeRate,
        subtotal, tax_amount: taxAmount, total,
        retention_pct: orig.retention_pct, retention_amount: retentionAmount,
        issuer_name: orig.issuer_name, issuer_cif: orig.issuer_cif, issuer_address: orig.issuer_address,
        issuer_city: orig.issuer_city, issuer_postal_code: orig.issuer_postal_code, issuer_province: orig.issuer_province,
        issuer_logo_url: orig.issuer_logo_url,
        client_name: orig.client_name, client_cif: orig.client_cif, client_address: orig.client_address,
        client_city: orig.client_city, client_postal_code: orig.client_postal_code, client_province: orig.client_province,
        client_country_code: orig.client_country_code, client_tax_id_type: orig.client_tax_id_type,
        notes: `Rectificativa por anulación de ${orig.full_number}`,
        huella: (huella = computeHuella(registroInput)), huella_anterior: previousHuella || null,
        qr_url: qrUrl, registro_alta: registroAlta,
        verifactu_status: 'generated', issued_at: generatedAt,
        payment_status: 'pending', rectifies_invoice_id: invoiceId,
        created_by: user.id,
      }
    })
    if ('error' in chained) return NextResponse.json({ error: 'insert_failed', detail: chained.error }, { status: 400 })
    const rec = chained

    // ── Negated lines ───────────────────────────────────────
    const negLines = (origLines ?? []).map((l, idx) => ({
      invoice_id: rec.id, product_id: l.product_id, description: l.description,
      quantity: -Number(l.quantity), unit_price: Number(l.unit_price), tax_rate: Number(l.tax_rate),
      discount_pct: Number(l.discount_pct), exemption_cause: l.exemption_cause,
      line_subtotal: round2(-Number(l.line_subtotal)), line_tax: round2(-Number(l.line_tax)), line_total: round2(-Number(l.line_total)),
      position: idx,
    }))
    if (negLines.length) {
      const { error: negErr } = await supabase.from('invoice_lines').insert(negLines)
      if (negErr) {
        await supabase.from('invoices').delete().eq('id', rec.id)
        return NextResponse.json({ error: 'lines_failed', detail: negErr.message }, { status: 400 })
      }
    }

    // ── Promote to issued now that the lines exist ──────────────
    const { error: issueErr } = await supabase
      .from('invoices').update({ state: 'issued' }).eq('id', rec.id)
    if (issueErr) {
      await supabase.from('invoices').delete().eq('id', rec.id)
      return NextResponse.json({ error: 'issue_failed', detail: issueErr.message }, { status: 400 })
    }

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
    // Archived with the service-role client: the documents bucket rejects the
    // caller's client, so from mobile the credit note never reached Biblioteca.
    try {
      const archiver = await createServerSupabase(true)
      const pdfBytes = await buildInvoicePdf({
        fullNumber, issueDate,
        issuer: { name: orig.issuer_name ?? '', cif: orig.issuer_cif, address: orig.issuer_address, postalCode: orig.issuer_postal_code, city: orig.issuer_city, province: orig.issuer_province, logoUrl: orig.issuer_logo_url },
        client: { name: orig.client_name ?? '', cif: orig.client_cif, address: orig.client_address, postalCode: orig.client_postal_code, city: orig.client_city, province: orig.client_province },
        lines: negLines.map(l => ({ description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, line_total: l.line_total })),
        subtotal, taxAmount, retentionPct: orig.retention_pct, retentionAmount, total, notes: `Rectificativa por anulación de ${orig.full_number}`, huella, qrUrl,
        currency, exchangeRate,
      })
      const storagePath = `${orgId}/invoices/${rec.id}.pdf`
      const { error: upErr } = await archiver.storage.from('documents').upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error(`storage upload failed: ${upErr.message}`)
      {
        const { data: doc, error: docErr } = await archiver.from('documents').insert({
          organization_id: orgId, company_id: orig.client_company_id, uploaded_by: user.id,
          document_number: fullNumber, document_type: 'invoice_issued', status: 'cancelled',
          total: eurTotal, currency: 'EUR', issue_date: issueDate,
          file_url: storagePath, file_name: `${fullNumber}.pdf`, file_size: pdfBytes.length, file_type: 'application/pdf',
        }).select('id').single()
        if (docErr) throw new Error(`library entry failed: ${docErr.message}`)
        if (doc) await archiver.from('invoices').update({ document_id: doc.id }).eq('id', rec.id)
      }
    } catch (pdfErr) {
      console.error('[invoices/rectify] archival to Biblioteca failed:', pdfErr)
    }

    return NextResponse.json({ success: true, id: rec.id, fullNumber: rec.full_number })
  } catch (err) {
    console.error('[invoices/rectify] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
