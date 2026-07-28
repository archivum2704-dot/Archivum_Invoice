import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { issueInvoice, IssueError } from '@/lib/invoice-issue'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { id, fullNumber } = await issueInvoice(supabase as never, user.id, {
      orgId: body.orgId,
      clientCompanyId: body.clientCompanyId,
      series: body.series,
      kind: body.kind,
      issueDate: body.issueDate,
      operationDate: body.operationDate,
      dueDate: body.dueDate,
      notes: body.notes,
      retentionPct: body.retentionPct,
      discountPct: body.discountPct,
      lines: body.lines,
    })

    return NextResponse.json({ success: true, id, fullNumber })
  } catch (err) {
    if (err instanceof IssueError) {
      return NextResponse.json({ error: err.message, detail: err.detail }, { status: err.status })
    }
    console.error('[invoices/issue] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
