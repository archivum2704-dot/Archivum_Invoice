import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { adminClient } from '@/lib/verifactu-submit'
import { runIntegrityCheck } from '@/lib/verifactu-integrity'

export const runtime = 'nodejs'
// Vercel Hobby caps this at 60 seconds; anything higher fails the build, not
// the request. Raise it here only together with the plan.
export const maxDuration = 60

/**
 * POST /api/verifactu/integrity — run the check on demand.
 *
 * The scheduled run covers the obligation; this exists so an admin can verify
 * their own chain when they want to, rather than waiting six hours to find out
 * whether anything is wrong.
 */
export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json() as { orgId?: string }
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db: any = adminClient()
    const { data: profile } = await db.from('profiles').select('platform_role').eq('id', user.id).single()
    if (profile?.platform_role !== 'super_admin') {
      const { data: member } = await db.from('organization_members')
        .select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    const report = await runIntegrityCheck(db, orgId)
    return NextResponse.json({ success: true, ...report })
  } catch (err) {
    console.error('[verifactu/integrity] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
