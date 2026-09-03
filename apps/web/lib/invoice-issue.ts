import {
  computeHuella, buildRegistroAlta, buildQrUrl, nowWithOffset,
  type InvoiceKind,
} from '@/lib/verifactu'
import { buildInvoicePdf } from '@/lib/invoice-pdf'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { insertChainedInvoice } from '@/lib/invoice-chain'
import { DEFAULT_CURRENCY, isValidCurrency, needsExchangeRate, toEur } from '@/lib/currency'

const round2 = (n: number) => Math.round(n * 100) / 100

export interface IssueLineInput {
  productId?: string | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discountPct?: number
  /** L10 cause, required when taxRate is 0. */
  exemptionCause?: string | null
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
  /** ISO 4217. Por defecto EUR. */
  currency?: string | null
  /** Euros por 1 unidad de `currency`. Obligatorio cuando currency ≠ EUR. */
  exchangeRate?: number | null
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

  const currency = (input.currency || DEFAULT_CURRENCY).toUpperCase()
  if (!isValidCurrency(currency)) throw new IssueError('unsupported_currency', 422)
  const exchangeRate = needsExchangeRate(currency) ? Number(input.exchangeRate) || 0 : null
  if (needsExchangeRate(currency) && !(exchangeRate! > 0)) {
    throw new IssueError('exchange_rate_required', 422,
      `Falta el tipo de cambio a euros para facturar en ${currency}.`)
  }

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('name, cif, address, city, postal_code, province, logo_url, verifactu_clave_regimen, verifactu_obligado')
    .eq('id', orgId).single()
  if (!org) throw new IssueError('org_not_found', 404, orgErr?.message)

  if (!clientCompanyId) throw new IssueError('client_required', 400)
  const { data: client, error: clientErr } = await supabase
    .from('companies')
    .select('name, cif, address, city, postal_code, province, country_code, tax_id_type')
    .eq('id', clientCompanyId).single()
  if (!client) throw new IssueError('client_not_found', 404, clientErr?.message)

  if (!org.cif?.trim())    throw new IssueError('issuer_cif_required', 422)
  if (!client.cif?.trim()) throw new IssueError('client_cif_required', 422)
  if (!issueDate)          throw new IssueError('issue_date_required', 422)

  // An exempt line must say under which article. Enforced here rather than only
  // in the form, because the quote → invoice conversion reaches this too, and a
  // record that invented an exemption cause would be immutable once issued.
  const exemptWithoutCause = lines.find(l => (Number(l.taxRate) || 0) === 0 && !l.exemptionCause)
  if (exemptWithoutCause) {
    throw new IssueError('exemption_cause_required', 422,
      `La línea "${exemptWithoutCause.description}" está exenta de IVA y no indica el motivo (artículo).`)
  }

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
      // Only carried when the line is actually exempt: a cause on a taxed line
      // would describe an exemption that is not being claimed.
      exemption_cause: rate === 0 ? (l.exemptionCause || null) : null,
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

  // Campos comunes a la factura, con y sin Verifactu.
  const baseRow = {
    organization_id: orgId, client_company_id: clientCompanyId,
    series, number, full_number: fullNumber,
    kind, state: 'draft',
    issue_date: issueDate, operation_date: operationDate || issueDate, due_date: dueDate || null,
    currency, exchange_rate: exchangeRate,
    subtotal, discount_pct: discPct || null, discount_amount: discountAmount,
    tax_amount: taxAmount, total,
    retention_pct: retPct || null, retention_amount: retentionAmount,
    issuer_name: org.name, issuer_cif: org.cif, issuer_address: org.address,
    issuer_city: org.city, issuer_postal_code: org.postal_code, issuer_province: org.province,
    issuer_logo_url: org.logo_url,
    client_name: client.name, client_cif: client.cif, client_address: client.address,
    client_city: client.city, client_postal_code: client.postal_code, client_province: client.province,
    client_country_code: client.country_code, client_tax_id_type: client.tax_id_type,
    notes: notes?.trim() || null,
    payment_status: 'pending', created_by: userId,
  }

  // ── Verifactu huella chain ──
  // Solo para quien declara en España. Una organización que no está sujeta a
  // las obligaciones de facturación españolas queda fuera del ámbito del RD
  // 1007/2023: no lleva registro de alta, ni huella, ni QR de cotejo, ni se
  // remite nada a la AEAT. La factura sigue siendo una factura, con su
  // numeración correlativa y su misma inalterabilidad.
  const obligado = org.verifactu_obligado !== false
  // El registro de alta, la huella y el QR de cotejo van siempre en euros: el
  // esquema de VeriFactu no tiene campo de moneda. La factura en sí (fila,
  // líneas, PDF) se queda en la moneda elegida; solo esto se convierte.
  const eurTaxAmount = toEur(taxAmount, currency, exchangeRate)
  const eurTotal = toEur(total, currency, exchangeRate)
  const qrUrl = obligado ? buildQrUrl(org.cif!.trim(), fullNumber, issueDate, eurTotal) : null
  let huella = ''

  const chained = obligado
    ? await insertChainedInvoice(supabase, orgId, ({ previousHuella, previousFullNumber, previousIssueDate, generatedAt }) => {
    const registroInput = {
      issuerNif: org.cif!.trim(), fullNumber, issueDate, kind: kind as InvoiceKind,
      cuotaTotal: eurTaxAmount, importeTotal: eurTotal, previousHuella,
      previousFullNumber, previousIssueDate, generatedAt,
    }
    huella = computeHuella(registroInput)
    const registroAlta = buildRegistroAlta({
      ...registroInput,
      issuerName: org.name,
      client: {
        name: client.name, id: client.cif!.trim(),
        countryCode: client.country_code, idType: client.tax_id_type,
      },
      installationId: orgId, notes: notes?.trim() || null,
      claveRegimen: org.verifactu_clave_regimen,
      lines: computedLines.map(l => ({
        description: l.description, taxRate: l.tax_rate,
        base: toEur(l.line_subtotal, currency, exchangeRate), cuota: toEur(l.line_tax, currency, exchangeRate),
        exemptionCause: l.exemption_cause,
      })),
    })
    return {
      ...baseRow,
      huella, huella_anterior: previousHuella || null,
      qr_url: qrUrl, registro_alta: registroAlta,
      verifactu_status: 'generated', issued_at: generatedAt,
    }
  })
    : await (async () => {
      // Sin cadena que reclamar: nada de huella, nada de eslabón, y el estado
      // dice «no aplica» en lugar de quedarse en «pendiente de enviar», que
      // haría que el barrido diario lo intentase para siempre.
      const { data, error } = await (supabase as any).from('invoices')
        .insert({ ...baseRow, verifactu_status: 'not_applicable', issued_at: nowWithOffset() })
        .select('id, full_number').single()
      return error || !data ? { error: error?.message ?? 'insert_failed' } : data
    })()

  if ('error' in chained) throw new IssueError('insert_failed', 400, chained.error)
  const invoice = chained

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
  // Archived with the service-role client. The documents bucket does not accept
  // the caller's client — it is seen as anonymous there, the same finding that
  // /api/organizations/logo documents — so the upload failed, and with it the
  // library entry, silently: an issued invoice never appeared in Biblioteca.
  try {
    const archiver = await createServerSupabase(true)
    const pdfBytes = await buildInvoicePdf({
      fullNumber, issueDate, dueDate: dueDate || null,
      issuer: { name: org.name, cif: org.cif, address: org.address, postalCode: org.postal_code, city: org.city, province: org.province, logoUrl: org.logo_url },
      client: { name: client.name, cif: client.cif, address: client.address, postalCode: client.postal_code, city: client.city, province: client.province },
      lines: computedLines.map(l => ({ description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, line_total: l.line_total })),
      subtotal, discountPct: discPct, discountAmount, taxAmount, retentionPct: retPct, retentionAmount, total,
      currency, exchangeRate,
      notes: notes?.trim() || null,
      huella: obligado ? huella : null, qrUrl: obligado ? qrUrl : null,
    })
    const storagePath = `${orgId}/invoices/${invoice.id}.pdf`
    const { error: upErr } = await archiver.storage
      .from('documents').upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`)
    {
      // La Biblioteca y el dashboard suman `documents.total` entre facturas de
      // distinta moneda como si todas fueran euros, así que aquí se guarda
      // siempre el equivalente en euros — no lo que ve el cliente — para que
      // esas sumas sigan siendo correctas. El importe en la moneda original
      // vive en `invoices.total` y es lo que se ve en el PDF.
      const { data: doc, error: docErr } = await archiver.from('documents').insert({
        organization_id: orgId, company_id: clientCompanyId, uploaded_by: userId,
        document_number: fullNumber, document_type: 'invoice_issued', status: 'pending',
        total: eurTotal, currency: 'EUR', issue_date: issueDate,
        file_url: storagePath, file_name: `${fullNumber}.pdf`, file_size: pdfBytes.length, file_type: 'application/pdf',
      }).select('id').single()
      if (docErr) throw new Error(`library entry failed: ${docErr.message}`)
      if (doc) await archiver.from('invoices').update({ document_id: doc.id }).eq('id', invoice.id)
    }
  } catch (pdfErr) {
    // Non-fatal: the invoice is legally issued either way, and refusing it here
    // would leave a numbered, chained invoice the caller believes failed.
    console.error('[issueInvoice] archival to Biblioteca failed:', pdfErr)
  }

  // The record was generated: art. 8.3 wants that logged as it happens. No
  // record, nothing to log — and an event claiming one would be false.
  if (obligado) try {
    const { recordEvent, EVENT_TYPES } = await import('@/lib/verifactu-events')
    await recordEvent(supabase, {
      orgId, type: EVENT_TYPES.ALTA,
      actor: { userId },
      detail: { fullNumber, huella, total, clientCif: client.cif },
    })
  } catch (evErr) {
    console.error('[issueInvoice] event not recorded:', evErr)
  }

  // Veri*Factu wants the record at the AEAT promptly, so it goes now rather
  // than waiting for the hourly sweep. Best-effort for the same reason as the
  // PDF: the invoice is already issued and immutable, and failing the call
  // here would tell the caller a legally-existing invoice did not happen. The
  // sweep picks up whatever does not get through.
  if (obligado) try {
    const { submitPendingForOrg } = await import('@/lib/verifactu-submit')
    const outcome = await submitPendingForOrg(orgId, { invoiceId: invoice.id })
    if (outcome.error || outcome.skipped) {
      console.warn('[issueInvoice] AEAT submission deferred:', outcome.error ?? outcome.skipped)
    }
  } catch (aeatErr) {
    console.error('[issueInvoice] AEAT submission failed:', aeatErr)
  }

  return { id: invoice.id, fullNumber: invoice.full_number }
}
