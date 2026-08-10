import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { archiveQuoteToLibrary } from '@/lib/quote-archive'

export const runtime = 'nodejs'
// Vercel Hobby caps this at 60 seconds; anything higher fails the build, not
// the request. Raise it here only together with the plan.
export const maxDuration = 60

/**
 * POST /api/quotes/archive
 *
 * Archive in the Biblioteca every quote and delivery note of the organization
 * that has no copy there yet.
 *
 * Archiving happens on its own when a quote is finalized or a note is opened,
 * but it is best-effort: storage can fail, and notes opened before this existed
 * were never archived at all. This is the repair, and it is worth having
 * permanently rather than as a one-off script — anything best-effort needs a
 * way to be retried.
 *
 * Idempotent: rows already archived are skipped, and re-archiving updates the
 * existing library entry instead of adding a second one.
 */
export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json() as { orgId?: string }
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    const supabase: any = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // Archiving writes with the service role, so the caller's right to do it is
    // checked here rather than left to RLS.
    const archiver: any = await createServerSupabase(true)
    const { data: profile } = await archiver.from('profiles')
      .select('platform_role').eq('id', user.id).single()
    if (profile?.platform_role !== 'super_admin') {
      const { data: member } = await archiver.from('organization_members')
        .select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    // Only finalized quotes: a draft has no number and nothing to archive yet.
    const { data: pendientes } = await archiver.from('quotes')
      .select('id, kind, full_number')
      .eq('organization_id', orgId)
      .is('document_id', null)
      .not('full_number', 'is', null)
      .limit(500)

    const archivados: string[] = []
    const fallidos: string[] = []
    for (const q of pendientes ?? []) {
      const ok = await archiveQuoteToLibrary(archiver, {
        quoteId: q.id, orgId, uploadedBy: user.id,
      })
      ;(ok ? archivados : fallidos).push(q.full_number ?? q.id)
    }

    return NextResponse.json({
      success: true,
      revisados: pendientes?.length ?? 0,
      archivados,
      fallidos,
    })
  } catch (err) {
    console.error('[quotes/archive] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
