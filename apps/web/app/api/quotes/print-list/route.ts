import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { buildQuoteListPdf } from '@/lib/quote-list-pdf'

/**
 * A printable checklist of several pedidos/albaranes — to review by hand
 * before billing them one by one. Does not touch billing: each item still
 * goes through /api/quotes/convert individually, unchanged.
 */
export async function POST(req: NextRequest) {
  try {
    const { orgId, ids } = await req.json()
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'no_ids' }, { status: 400 })
    if (ids.length > 200) return NextResponse.json({ error: 'too_many' }, { status: 400 })

    const supabase: any = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
    if (!org) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })

    // Scoped to the org regardless of which ids were sent — RLS would also
    // catch a foreign id, but filtering here means the count in the PDF
    // matches what was actually found rather than silently dropping rows.
    const { data: quotes } = await supabase
      .from('quotes')
      .select('full_number, client_name, issue_date, total, currency, kind, organization_id')
      .eq('organization_id', orgId)
      .in('id', ids)
      .order('issue_date')

    if (!quotes || quotes.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const kind = quotes[0].kind === 'delivery_note' ? 'delivery_note' : 'quote'

    const pdfBytes = await buildQuoteListPdf({
      kind,
      issuerName: org.name ?? '',
      items: quotes.map((q: any) => ({
        fullNumber: q.full_number ?? '—',
        clientName: q.client_name ?? '—',
        issueDate: q.issue_date ?? '',
        total: Number(q.total) || 0,
        currency: q.currency,
      })),
      generatedAt: new Date().toLocaleDateString('es-ES'),
    })

    const filename = kind === 'delivery_note' ? 'listado-albaranes.pdf' : 'listado-pedidos.pdf'
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[quotes/print-list] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
