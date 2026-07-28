import {
  computeHuella, buildRegistroAlta, buildQrUrl, nowWithOffset,
  type InvoiceKind,
} from '@/lib/verifactu'
import { buildInvoicePdf } from '@/lib/invoice-pdf'
import type { SupabaseClient } from '@supabase/supabase-js'

const round2 = (n: number) => Math.round(n * 100) / 100

export interface IssueLineInput {
  productId?: string | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discountPct?: number
}

export interface IssueInvoiceInput {
  orgId: string
  clientCompanyId: string
  series?: string
  kind?: InvoiceKind
  issueDate: string
  operationDate?: string | null
  dueDate?: string | null
  notes?: string | null
  retentionPct?: number
  discountPct?: number
  lines: IssueLineInput[]
}

export class IssueError extends Error {
  status: number
  detail?: string
  constructor(code: string, status = 400, detail?: string) {
    super(code)
    this.status = status
    this.detail = detail
  }
}

/**
 * Core invoice-issuing logic shared by POST /api/invoices/issue and the
 * quote → invoice conversion. Assigns the number, computes the Verifactu
 * huella, inserts the invoice + lines, promotes to 'issued', decrements
 * stock, and archives a PDF to the library. Throws IssueError on failure.
 */
export async function issueInvoice(
  supabase: SupabaseClient,
  userId: string,
  input: IssueInvoiceInput,
): Promise<{ id: string; fullNumber: string }> {
  const {
    orgId, clientCompanyId, series = 'FAC', kind = 'ordinary' as InvoiceKind,
    issueDate, operationDate, dueDate, notes, retentionPct = 0, discountPct = 0, lines = [],
  } = input

  if (!orgId) throw new IssueError('missing_org', 400)
  if (!Array.isArray(lines) || lines.length === 0) throw new IssueError('no_lines', 400)

  const { data: org } = await supabase
    .from('organizations')
    .select('name, cif, address, city, postal_code, province, logo_url')
    .eq('id', orgId).single()
  if (!org) throw new IssueError('org_not_found', 404)

  if (!clientCompanyId) throw new IssueError('client_required', 400)
  const { data: client } = await supabase
    .from('companies')
    .select('name, cif, address, city, postal_code, province')
    .eq('id', clientCompanyId).single()
  if (!client) throw new IssueError('client_not_found', 404)

  if (!org.cif?.trim())    throw new IssueError('issuer_cif_required', 422)
  if (!client.cif?.trim()) throw new IssueError('client_cif_required', 422)
  if (!issueDate)          throw new IssueError('issue_date_required', 422)

  // ── Totals (per-line gross, then a global discount reducing base + tax) ──
  let grossBase = 0, grossTax = 0
  const computedLines = lines.map((l, idx) => {
    const qty = Number(l.quantity) || 0
    const price = Number(l.unitPrice) || 0
    const rate = Number(l.taxRate) || 0
    const disc = Number(l.discountPct) || 0
    const base = round2(qty * price * (1 - disc / 100))
    const tax = round2(base * rate / 100)
    grossBase += base
    grossTax += tax
    return {
      product_id: l.productId ?? null,
      description: l.description?.trim() || '—',
      quantity: qty, unit_price: price, tax_rate: rate, discount_pct: disc,
      line_subtotal: base, line_tax: tax, line_total: round2(base + tax),
      position: idx,
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

  // ── Atomic number ──
  const year = parseInt(issueDate.split('-')[0], 10)
  const { data: number, error: numErr } = await supabase
    .rpc('next_invoice_number', { p_org: orgId, p_series: series, p_year: year })
  if (numErr || number == null) throw new IssueError('numbering_failed', 403, numErr?.message)
  const fullNumber = `${series}-${year}-${String(number).padStart(4, '0')}`

  // ── Verifactu huella chain ──
  const { data: prev } = await supabase
    .from('invoices').select('huella')
    .eq('organization_id', orgId).eq('state', 'issued')
    .not('huella', 'is', null)
    .order('issued_at', { ascending: false }).limit(1).maybeSingle()
  const previousHuella = prev?.huella ?? ''
  const generatedAt = nowWithOffset()

  const registroInput = {
    issuerNif: org.cif!.trim(), fullNumber, issueDate, kind: kind as InvoiceKind,
    cuotaTotal: taxAmount, importeTotal: total, previousHuella, generatedAt,
  }
  const huella = computeHuella(registroInput)
  const registroAlta = buildRegistroAlta({
    ...registroInput, issuerName: org.name, clientNif: client.cif!.trim(), clientName: client.name,
  })
  const qrUrl = buildQrUrl(org.cif!.trim(), fullNumber, issueDate, total)

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      organization_id: orgId, client_company_id: clientCompanyId,
      series, number, full_number: fullNumber,
      kind, state: 'draft',
      issue_date: issueDate, operation_date: operationDate || issueDate, due_date: dueDate || null,
      subtotal, discount_pct: discPct || null, discount_amount: discountAmount,
      tax_amount: taxAmount, total,
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
      payment_status: 'pending', created_by: userId,
    })
    .select('id, full_number').single()
  if (invErr || !invoice) throw new IssueError('insert_failed', 400, invErr?.message)

  const { error: linesErr } = await supabase
    .from('invoice_lines')
    .insert(computedLines.map(l => ({ ...l, invoice_id: invoice.id })))
  if (linesErr) {
    await supabase.from('invoices').delete().eq('id', invoice.id)
    throw new IssueError('lines_failed', 400, linesErr.message)
  }

  const { error: issueErr } = await supabase
    .from('invoices').update({ state: 'issued' }).eq('id', invoice.id)
  if (issueErr) {
    await supabase.from('invoices').delete().eq('id', invoice.id)
    throw new IssueError('issue_failed', 400, issueErr.message)
  }

  // Decrement stock for tracked products
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

  // Best-effort: PDF + archive in the library
  try {
    const pdfBytes = await buildInvoicePdf({
      fullNumber, issueDate, dueDate: dueDate || null,
      issuer: { name: org.name, cif: org.cif, address: org.address, postalCode: org.postal_code, city: org.city, province: org.province, logoUrl: org.logo_url },
      client: { name: client.name, cif: client.cif, address: client.address, postalCode: client.postal_code, city: client.city, province: client.province },
      lines: computedLines.map(l => ({ description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, line_total: l.line_total })),
      subtotal, discountPct: discPct, discountAmount, taxAmount, retentionPct: retPct, retentionAmount, total,
      notes: notes?.trim() || null, huella, qrUrl,
    })
    const storagePath = `${orgId}/invoices/${invoice.id}.pdf`
    const { error: upErr } = await supabase.storage
      .from('documents').upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })
    if (!upErr) {
      const { data: doc } = await supabase.from('documents').insert({
        organization_id: orgId, company_id: clientCompanyId, uploaded_by: userId,
        document_number: fullNumber, document_type: 'invoice_issued', status: 'pending',
        total, currency: 'EUR', issue_date: issueDate,
        file_url: storagePath, file_name: `${fullNumber}.pdf`, file_size: pdfBytes.length, file_type: 'application/pdf',
      }).select('id').single()
      if (doc) await supabase.from('invoices').update({ document_id: doc.id }).eq('id', invoice.id)
    }
  } catch (pdfErr) {
    console.warn('[issueInvoice] PDF archival failed (non-fatal):', pdfErr)
  }

  return { id: invoice.id, fullNumber: invoice.full_number }
}
