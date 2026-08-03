import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { issueInvoice, IssueError } from '@/lib/invoice-issue'

/**
 * Turn a delivery note into a real Verifactu invoice.
 *
 * Only a delivery note can be billed. A quote opens one when it is finalized,
 * so the path to a bill is presupuesto → albarán → factura and there is no
 * second route that could invoice the same work twice.
 */
export async function POST(req: NextRequest) {
  try {
    const { quoteId } = await req.json()
    if (!quoteId) return NextResponse.json({ error: 'missing_quote' }, { status: 400 })

    const supabase: any = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: quote } = await supabase
      .from('quotes')
      .select('id, organization_id, client_company_id, notes, retention_pct, discount_pct, status, kind, source_quote_id, converted_invoice_id')
      .eq('id', quoteId).single()
    if (!quote) return NextResponse.json({ error: 'quote_not_found' }, { status: 404 })
    if (quote.status === 'converted' && quote.converted_invoice_id) {
      return NextResponse.json({ success: true, invoiceId: quote.converted_invoice_id, alreadyConverted: true })
    }
    if (quote.kind !== 'delivery_note') {
      return NextResponse.json({ error: 'not_a_delivery_note' }, { status: 422 })
    }
    if (!quote.client_company_id) return NextResponse.json({ error: 'client_required' }, { status: 400 })

    const { data: lines } = await supabase
      .from('quote_lines')
      .select('product_id, description, quantity, unit_price, tax_rate, discount_pct, position')
      .eq('quote_id', quoteId).order('position')
    if (!lines || lines.length === 0) return NextResponse.json({ error: 'no_lines' }, { status: 400 })

    const issueDate = new Date().toISOString().slice(0, 10)
    const { id: invoiceId } = await issueInvoice(supabase, user.id, {
      orgId: quote.organization_id,
      clientCompanyId: quote.client_company_id,
      issueDate,
      notes: quote.notes,
      retentionPct: Number(quote.retention_pct) || 0,
      discountPct: Number(quote.discount_pct) || 0,
      lines: lines.map((l: any) => ({
        productId: l.product_id,
        description: l.description,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unit_price) || 0,
        taxRate: Number(l.tax_rate) || 0,
        discountPct: Number(l.discount_pct) || 0,
      })),
    })

    // The note is billed; its quote is settled with it.
    if (quote.source_quote_id) {
      await supabase.from('quotes')
        .update({ status: 'accepted' }).eq('id', quote.source_quote_id)
    }

    await supabase.from('quotes')
      .update({ status: 'converted', converted_invoice_id: invoiceId })
      .eq('id', quoteId)

    return NextResponse.json({ success: true, invoiceId })
  } catch (err) {
    if (err instanceof IssueError) {
      return NextResponse.json({ error: err.message, detail: err.detail }, { status: err.status })
    }
    console.error('[quotes/convert] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
