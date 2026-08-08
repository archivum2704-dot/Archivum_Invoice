import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { submitPendingForOrg, adminClient } from '@/lib/verifactu-submit'

export const runtime = 'nodejs'
// The AEAT can be slow, and a submission carries up to 100 records.
export const maxDuration = 120

/**
 * POST /api/verifactu/submit
 *
 * Submit an organization's outstanding records to the AEAT on demand.
 *
 * The cron sweep does this on its own; this exists so an admin who is watching
 * a rejection can retry without waiting for the next sweep, and so a first
 * submission can be tried deliberately while the setup is being verified.
 */
export async function POST(req: NextRequest) {
  try {
    const { orgId, invoiceId } = await req.json() as { orgId?: string; invoiceId?: string }
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // Submitting is an act of the taxpayer, so only their admins may trigger it.
    const db: any = adminClient()
    const { data: profile } = await db.from('profiles').select('platform_role').eq('id', user.id).single()
    if (profile?.platform_role !== 'super_admin') {
      const { data: member } = await db.from('organization_members')
        .select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    const outcome = await submitPendingForOrg(orgId, { invoiceId })
    return NextResponse.json({ success: !outcome.error, ...outcome })
  } catch (err) {
    console.error('[verifactu/submit] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
