import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { buildQuotePdf } from '@/lib/quote-pdf'

/** Generate (on the fly) and return the quote PDF for download. */
export async function GET(req: NextRequest) {
  try {
    const quoteId = new URL(req.url).searchParams.get('id')
    if (!quoteId) return NextResponse.json({ error: 'missing_quote' }, { status: 400 })

    const supabase: any = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: q } = await supabase.from('quotes').select('*').eq('id', quoteId).single()
    if (!q) return NextResponse.json({ error: 'quote_not_found' }, { status: 404 })

    const { data: lines } = await supabase
      .from('quote_lines')
      .select('description, quantity, unit_price, tax_rate, line_total, position')
      .eq('quote_id', quoteId).order('position')

    const pdfBytes = await buildQuotePdf({
      kind: q.kind ?? 'quote',
      fullNumber: q.full_number ?? (q.kind === 'delivery_note' ? 'ALBARÁN' : 'PRESUPUESTO'),
      issueDate: q.issue_date ?? '',
      validUntil: q.valid_until,
      issuer: { name: q.issuer_name ?? '', cif: q.issuer_cif, address: q.issuer_address, postalCode: q.issuer_postal_code, city: q.issuer_city, province: q.issuer_province, logoUrl: q.issuer_logo_url },
      client: { name: q.client_name ?? '', cif: q.client_cif, address: q.client_address, postalCode: q.client_postal_code, city: q.client_city, province: q.client_province },
      lines: (lines ?? []).map((l: any) => ({ description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unit_price), tax_rate: Number(l.tax_rate), line_total: Number(l.line_total) })),
      subtotal: Number(q.subtotal), discountPct: q.discount_pct, discountAmount: Number(q.discount_amount),
      taxAmount: Number(q.tax_amount), retentionPct: q.retention_pct, retentionAmount: Number(q.retention_amount),
      total: Number(q.total), notes: q.notes,
      currency: q.currency, exchangeRate: q.exchange_rate,
    })

    const filename = `${q.full_number ?? 'presupuesto'}.pdf`
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[quotes/pdf] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
