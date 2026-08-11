import type { SupabaseClient } from '@supabase/supabase-js'
import { buildInvoicePdf } from '@/lib/invoice-pdf'
import { buildQuotePdf } from '@/lib/quote-pdf'

export type DocKind = 'invoice' | 'quote'

export interface RenderedDocument {
  bytes: Uint8Array
  filename: string
  /** What the document is called in Spanish, for subjects and email bodies. */
  label: string
  fullNumber: string
  total: number
  issueDate: string | null
  clientName: string | null
  clientEmail: string | null
  issuerName: string | null
  organizationId: string
}

/**
 * Render an invoice or a quote/delivery note to PDF from its stored row.
 *
 * The PDF is always rebuilt from the database rather than read back from
 * storage: archival to Biblioteca is best-effort, so a stored copy may not
 * exist, and rebuilding guarantees the download and the emailed attachment are
 * the same document. Reads go through the caller's client, so RLS decides what
 * they may render.
 */
export async function renderDocument(
  supabase: SupabaseClient,
  kind: DocKind,
  id: string,
): Promise<RenderedDocument | null> {
  const db = supabase as any

  if (kind === 'invoice') {
    const { data: inv } = await db.from('invoices').select('*').eq('id', id).single()
    if (!inv) return null

    const { data: lines } = await db.from('invoice_lines')
      .select('description, quantity, unit_price, tax_rate, line_total, position')
      .eq('invoice_id', id).order('position')

    const bytes = await buildInvoicePdf({
      fullNumber: inv.full_number ?? 'FACTURA',
      issueDate: inv.issue_date ?? '',
      dueDate: inv.due_date,
      issuer: { name: inv.issuer_name ?? '', cif: inv.issuer_cif, address: inv.issuer_address, postalCode: inv.issuer_postal_code, city: inv.issuer_city, province: inv.issuer_province, logoUrl: inv.issuer_logo_url },
      client: { name: inv.client_name ?? '', cif: inv.client_cif, address: inv.client_address, postalCode: inv.client_postal_code, city: inv.client_city, province: inv.client_province },
      lines: (lines ?? []).map((l: any) => ({
        description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unit_price),
        tax_rate: Number(l.tax_rate), line_total: Number(l.line_total),
      })),
      subtotal: Number(inv.subtotal), discountPct: inv.discount_pct, discountAmount: Number(inv.discount_amount ?? 0),
      taxAmount: Number(inv.tax_amount), retentionPct: inv.retention_pct, retentionAmount: Number(inv.retention_amount ?? 0),
      total: Number(inv.total), notes: inv.notes,
      // Nulos cuando la factura no lleva registro: el PDF omite el bloque
      // Verifactu en lugar de imprimirlo vacío.
      huella: inv.huella ?? null, qrUrl: inv.qr_url ?? null,
    })

    const clientEmail = await lookupClientEmail(db, inv.client_company_id)
    return {
      bytes,
      filename: `${inv.full_number ?? 'factura'}.pdf`,
      label: inv.kind === 'rectifying' ? 'factura rectificativa' : 'factura',
      fullNumber: inv.full_number ?? '',
      total: Number(inv.total),
      issueDate: inv.issue_date,
      clientName: inv.client_name,
      clientEmail,
      issuerName: inv.issuer_name,
      organizationId: inv.organization_id,
    }
  }

  const { data: q } = await db.from('quotes').select('*').eq('id', id).single()
  if (!q) return null

  const { data: lines } = await db.from('quote_lines')
    .select('description, quantity, unit_price, tax_rate, line_total, position')
    .eq('quote_id', id).order('position')

  const isNote = q.kind === 'delivery_note'
  const bytes = await buildQuotePdf({
    kind: isNote ? 'delivery_note' : 'quote',
    fullNumber: q.full_number ?? (isNote ? 'ALBARÁN' : 'PEDIDO'),
    issueDate: q.issue_date ?? '',
    validUntil: q.valid_until,
    issuer: { name: q.issuer_name ?? '', cif: q.issuer_cif, address: q.issuer_address, postalCode: q.issuer_postal_code, city: q.issuer_city, province: q.issuer_province, logoUrl: q.issuer_logo_url },
    client: { name: q.client_name ?? '', cif: q.client_cif, address: q.client_address, postalCode: q.client_postal_code, city: q.client_city, province: q.client_province },
    lines: (lines ?? []).map((l: any) => ({
      description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unit_price),
      tax_rate: Number(l.tax_rate), line_total: Number(l.line_total),
    })),
    subtotal: Number(q.subtotal), discountPct: q.discount_pct, discountAmount: Number(q.discount_amount ?? 0),
    taxAmount: Number(q.tax_amount), retentionPct: q.retention_pct, retentionAmount: Number(q.retention_amount ?? 0),
    total: Number(q.total), notes: q.notes,
  })

  const clientEmail = await lookupClientEmail(db, q.client_company_id)
  return {
    bytes,
    filename: `${q.full_number ?? (isNote ? 'albaran' : 'pedido')}.pdf`,
    label: isNote ? 'albarán' : 'pedido',
    fullNumber: q.full_number ?? '',
    total: Number(q.total),
    issueDate: q.issue_date,
    clientName: q.client_name,
    clientEmail,
    issuerName: q.issuer_name,
    organizationId: q.organization_id,
  }
}

/**
 * The address the document is sent to by default. Documents snapshot the
 * client's name and CIF at issue time but not the email, so it comes from the
 * client record — and stays current if it was corrected afterwards.
 */
async function lookupClientEmail(db: any, companyId: string | null): Promise<string | null> {
  if (!companyId) return null
  const { data } = await db.from('companies').select('email').eq('id', companyId).maybeSingle()
  return data?.email ?? null
}
