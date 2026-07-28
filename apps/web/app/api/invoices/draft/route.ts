import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'

const round2 = (n: number) => Math.round(n * 100) / 100

interface LineInput {
  productId?: string | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  discountPct?: number
}

/**
 * Save an invoice as a draft (state = 'draft'). Unlike /issue this does NOT
 * assign a number, compute the Verifactu huella, or generate a PDF — it just
 * persists whatever the user has entered so they can finish it later.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      orgId, clientCompanyId = null, series = 'FAC', kind = 'ordinary',
      issueDate = null, notes = null, retentionPct = 0, discountPct = 0, lines = [] as LineInput[],
    } = body

    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    // Issuer snapshot (best-effort — draft has no mandatory fields)
    const { data: org } = await supabase
      .from('organizations')
      .select('name, cif, address, city, postal_code, province, logo_url')
      .eq('id', orgId).single()

    // Optional client snapshot
    let client: Record<string, string | null> | null = null
    if (clientCompanyId) {
      const { data } = await supabase
        .from('companies')
        .select('name, cif, address, city, postal_code, province')
        .eq('id', clientCompanyId).single()
      client = data ?? null
    }

    // Totals over the lines that have a description
    const validLines = (Array.isArray(lines) ? lines : []).filter(l => l?.description?.trim())
    let subtotal = 0, taxAmount = 0
    const computedLines = validLines.map((l, idx) => {
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
        description: l.description.trim(),
        quantity: qty, unit_price: price, tax_rate: rate, discount_pct: disc,
        line_subtotal: base, line_tax: tax, line_total: round2(base + tax),
        position: idx,
      }
    })
    subtotal = round2(subtotal)
    taxAmount = round2(taxAmount)
    const discPct = Number(discountPct) || 0
    const discountAmount = round2(subtotal * discPct / 100)
    const netBase = round2(subtotal - discountAmount)
    taxAmount = round2(taxAmount * (1 - discPct / 100))
    const retPct = Number(retentionPct) || 0
    const retentionAmount = round2(netBase * retPct / 100)
    const total = round2(netBase + taxAmount - retentionAmount)

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        organization_id: orgId,
        client_company_id: clientCompanyId || null,
        series, kind, state: 'draft',
        issue_date: issueDate || null,
        subtotal, discount_pct: discPct || null, discount_amount: discountAmount,
        tax_amount: taxAmount, total,
        retention_pct: retPct || null, retention_amount: retentionAmount,
        issuer_name: org?.name ?? null, issuer_cif: org?.cif ?? null, issuer_address: org?.address ?? null,
        issuer_city: org?.city ?? null, issuer_postal_code: org?.postal_code ?? null, issuer_province: org?.province ?? null,
        issuer_logo_url: org?.logo_url ?? null,
        client_name: client?.name ?? null, client_cif: client?.cif ?? null, client_address: client?.address ?? null,
        client_city: client?.city ?? null, client_postal_code: client?.postal_code ?? null, client_province: client?.province ?? null,
        notes: notes?.trim?.() || null,
        verifactu_status: 'pending',
        payment_status: 'pending',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (invErr || !invoice)
      return NextResponse.json({ error: 'insert_failed', detail: invErr?.message }, { status: 400 })

    if (computedLines.length > 0) {
      const { error: linesErr } = await supabase
        .from('invoice_lines')
        .insert(computedLines.map(l => ({ ...l, invoice_id: invoice.id })))
      if (linesErr) {
        await supabase.from('invoices').delete().eq('id', invoice.id)
        return NextResponse.json({ error: 'lines_failed', detail: linesErr.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, id: invoice.id })
  } catch (err) {
    console.error('[invoices/draft] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
