import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { annulInvoiceRecord } from '@/lib/verifactu-annul'
import { adminClient, submitPendingForOrg } from '@/lib/verifactu-submit'

export const runtime = 'nodejs'

/**
 * POST /api/invoices/annul
 *
 * Generate a registro de anulación for an invoice issued in error (art. 11).
 *
 * Distinct from /api/invoices/rectify on purpose. A rectificativa says the
 * invoice was wrong; an anulación says its record should never have existed.
 * Offering one button for both would let a user pick the wrong instrument
 * without knowing there was a choice.
 */
export async function POST(req: NextRequest) {
  try {
    const { orgId, invoiceId, reason } = await req.json() as {
      orgId?: string; invoiceId?: string; reason?: string
    }
    if (!orgId || !invoiceId) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // Annulling is an act of the taxpayer; the service role does the writing,
    // so authorisation is checked here rather than left to RLS.
    const db: any = adminClient()
    const { data: profile } = await db.from('profiles').select('platform_role').eq('id', user.id).single()
    if (profile?.platform_role !== 'super_admin') {
      const { data: member } = await db.from('organization_members')
        .select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    const result = await annulInvoiceRecord(db, user.id, { orgId, invoiceId, reason })
    if ('error' in result) {
      return NextResponse.json({ error: result.code ?? 'annul_failed', detail: result.error }, { status: 422 })
    }

    // Best-effort, like issuing: the record exists and is chained either way.
    try {
      await submitPendingForOrg(orgId)
    } catch (err) {
      console.error('[invoices/annul] AEAT submission deferred:', err)
    }

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[invoices/annul] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
