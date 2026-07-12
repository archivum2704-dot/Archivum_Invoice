import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import {
  computeHuella, buildRegistroAlta, buildQrUrl, nowWithOffset,
  type InvoiceKind,
} from '@/lib/verifactu'
import { buildInvoicePdf } from '@/lib/invoice-pdf'

const round2 = (n: number) => Math.round(n * 100) / 100

interface LineInput {
  productId?: string | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discountPct?: number
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      orgId, clientCompanyId, series = 'FAC', kind = 'ordinary' as InvoiceKind,
      issueDate, operationDate, dueDate, notes, retentionPct = 0, lines = [] as LineInput[],
    } = body

    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })
    if (!Array.isArray(lines) || lines.length === 0)
      return NextResponse.json({ error: 'no_lines' }, { status: 400 })

    // ── Issuer (organization) snapshot ──────────────────────
    const { data: org } = await supabase
      .from('organizations')
      .select('name, cif, address, city, postal_code, province, logo_url')
      .eq('id', orgId).single()
    if (!org) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })

    // ── Client (receptor) ───────────────────────────────────
    if (!clientCompanyId) return NextResponse.json({ error: 'client_required' }, { status: 400 })
    const { data: client } = await supabase
      .from('companies')
      .select('name, cif, address, city, postal_code, province')
      .eq('id', clientCompanyId).single()
    if (!client) return NextResponse.json({ error: 'client_not_found' }, { status: 404 })

    // ── Mandatory-field validation (Verifactu) ──────────────
    if (!org.cif?.trim())     return NextResponse.json({ error: 'issuer_cif_required' }, { status: 422 })
    if (!client.cif?.trim())  return NextResponse.json({ error: 'client_cif_required' }, { status: 422 })
    if (!issueDate)           return NextResponse.json({ error: 'issue_date_required' }, { status: 422 })

    // ── Totals ──────────────────────────────────────────────
    let subtotal = 0, taxAmount = 0
    const computedLines = lines.map((l, idx) => {
      const qty = Number(l.quantity) || 0
      const price = Number(l.unitPrice) || 0
      const rate = Number(l.taxRate) || 0
      const disc = Number(l.discountPct) || 0
      const base = round2(qty * price * (1 - disc / 100))
      const tax = round2(base * rate / 100)
      subtotal += base
      taxAmount += tax
      return {
        product_id: l.productId ?? null,
        description: l.description?.trim() || '—',
        quantity: qty,
        unit_price: price,
        tax_rate: rate,
        discount_pct: disc,
        line_subtotal: base,
        line_tax: tax,
        line_total: round2(base + tax),
        position: idx,
      }
    })
    subtotal = round2(subtotal)
    taxAmount = round2(taxAmount)
    const retPct = Number(retentionPct) || 0
    const retentionAmount = round2(subtotal * retPct / 100)
    const total = round2(subtotal + taxAmount - retentionAmount)

    // ── Atomic invoice number ───────────────────────────────
    const year = parseInt(issueDate.split('-')[0], 10)
    const { data: number, error: numErr } = await supabase
      .rpc('next_invoice_number', { p_org: orgId, p_series: series, p_year: year })
    if (numErr || number == null)
      return NextResponse.json({ error: 'numbering_failed', detail: numErr?.message }, { status: 403 })
    const fullNumber = `${series}-${year}-${String(number).padStart(4, '0')}`

    // ── Verifactu huella chain (previous issued record) ─────
    const { data: prev } = await supabase
      .from('invoices')
      .select('huella')
      .eq('organization_id', orgId).eq('state', 'issued')
      .not('huella', 'is', null)
      .order('issued_at', { ascending: false }).limit(1).maybeSingle()
    const previousHuella = prev?.huella ?? ''
    const generatedAt = nowWithOffset()

    const registroInput = {
      issuerNif: org.cif!.trim(),
      fullNumber,
      issueDate,
      kind: kind as InvoiceKind,
      cuotaTotal: taxAmount,
      importeTotal: total,
      previousHuella,
      generatedAt,
    }
    const huella = computeHuella(registroInput)
    const registroAlta = buildRegistroAlta({
      ...registroInput,
      issuerName: org.name,
      clientNif: client.cif!.trim(),
      clientName: client.name,
    })
    const qrUrl = buildQrUrl(org.cif!.trim(), fullNumber, issueDate, total)

    // ── Insert invoice ──────────────────────────────────────
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        organization_id: orgId,
        client_company_id: clientCompanyId,
        series, number, full_number: fullNumber,
        // Created as draft so the lines can be inserted; flipped to
        // 'issued' below once they exist. (Line inserts are rejected by the
        // immutability trigger while the parent is already 'issued'.)
        kind, state: 'draft',
        issue_date: issueDate,
        operation_date: operationDate || issueDate,
        due_date: dueDate || null,
        subtotal, tax_amount: taxAmount, total,
        retention_pct: retPct || null, retention_amount: retentionAmount,
        issuer_name: org.name, issuer_cif: org.cif, issuer_address: org.address,
        issuer_city: org.city, issuer_postal_code: org.postal_code, issuer_province: org.province,
        issuer_logo_url: org.logo_url,
        client_name: client.name, client_cif: client.cif, client_address: client.address,
        client_city: client.city, client_postal_code: client.postal_code, client_province: client.province,
        notes: notes?.trim() || null,
        huella, huella_anterior: previousHuella || null,
        qr_url: qrUrl, registro_alta: registroAlta,
        verifactu_status: 'generated', issued_at: generatedAt,
        payment_status: 'pending',
        created_by: user.id,
      })
      .select('id, full_number')
      .single()
    if (invErr || !invoice)
      return NextResponse.json({ error: 'insert_failed', detail: invErr?.message }, { status: 400 })

    // ── Insert lines ────────────────────────────────────────
    const { error: linesErr } = await supabase
      .from('invoice_lines')
      .insert(computedLines.map(l => ({ ...l, invoice_id: invoice.id })))
    if (linesErr) {
      // Roll back the draft so we don't leave an empty record (lines cascade)
      await supabase.from('invoices').delete().eq('id', invoice.id)
      return NextResponse.json({ error: 'lines_failed', detail: linesErr.message }, { status: 400 })
    }

    // ── Promote to issued now that the lines exist ──────────────
    const { error: issueErr } = await supabase
      .from('invoices').update({ state: 'issued' }).eq('id', invoice.id)
    if (issueErr) {
      await supabase.from('invoices').delete().eq('id', invoice.id)
      return NextResponse.json({ error: 'issue_failed', detail: issueErr.message }, { status: 400 })
    }

    // ── Decrement stock for tracked products ────────────────
    for (const l of computedLines) {
      if (!l.product_id) continue
      const { data: prod } = await supabase
        .from('products').select('track_stock, stock_qty').eq('id', l.product_id).single()
      if (prod?.track_stock) {
        await supabase.from('products')
          .update({ stock_qty: round2(Number(prod.stock_qty) - l.quantity) })
          .eq('id', l.product_id)
      }
    }

    // ── Best-effort: generate PDF, store it, archive in the library ──
    try {
      const pdfBytes = await buildInvoicePdf({
        fullNumber, issueDate, dueDate: dueDate || null,
        issuer: { name: org.name, cif: org.cif, address: org.address, postalCode: org.postal_code, city: org.city, province: org.province, logoUrl: org.logo_url },
        client: { name: client.name, cif: client.cif, address: client.address, postalCode: client.postal_code, city: client.city, province: client.province },
        lines: computedLines.map(l => ({ description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, line_total: l.line_total })),
        subtotal, taxAmount, retentionPct: retPct, retentionAmount, total, notes: notes?.trim() || null, huella, qrUrl,
      })
      const storagePath = `${orgId}/invoices/${invoice.id}.pdf`
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })
      if (!upErr) {
        const { data: doc } = await supabase.from('documents').insert({
          organization_id: orgId,
          company_id: clientCompanyId,
          uploaded_by: user.id,
          document_number: fullNumber,
          document_type: 'invoice_issued',
          status: 'pending',
          total, currency: 'EUR', issue_date: issueDate,
          file_url: storagePath, file_name: `${fullNumber}.pdf`,
          file_size: pdfBytes.length, file_type: 'application/pdf',
        }).select('id').single()
        if (doc) await supabase.from('invoices').update({ document_id: doc.id }).eq('id', invoice.id)
      }
    } catch (pdfErr) {
      console.warn('[invoices/issue] PDF archival failed (non-fatal):', pdfErr)
    }

    return NextResponse.json({ success: true, id: invoice.id, fullNumber: invoice.full_number })
  } catch (err) {
    console.error('[invoices/issue] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
