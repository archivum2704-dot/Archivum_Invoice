import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getApiClient } from '@/lib/supabase/api-auth'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

// Confirmed via Supabase logs that neither a direct client-side upload nor
// a cookie-authenticated server-side upload attaches as `authenticated` to
// the Storage API for this bucket — both were rejected by RLS as `anon`,
// even though the same session works fine everywhere else (PostgREST reads,
// the `documents` bucket, etc). Rather than depend on that, this route
// verifies the caller is an org admin/owner (or platform super-admin) using
// the normal RLS-respecting client, then performs the actual write with the
// service-role client (bypassing Storage RLS entirely) — the same pattern
// /api/inbox/webhook already uses for privileged storage writes.
async function assertOrgAdmin(supabase: SupabaseClient, userId: string, orgId: string) {
  const { data: profile } = await supabase.from('profiles').select('platform_role').eq('id', userId).single()
  if (profile?.platform_role === 'super_admin') return true
  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  return member?.role === 'owner' || member?.role === 'admin'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // Cast through unknown: @types/node's undici typings clash with the DOM
    // FormData here, stripping its methods from req.formData()'s return type.
    const form = (await req.formData()) as unknown as FormData
    const orgId = form.get('orgId')
    const file = form.get('file')
    if (typeof orgId !== 'string' || !orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'missing_file' }, { status: 400 })

    if (!(await assertOrgAdmin(supabase, user.id, orgId)))
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const ext = ALLOWED_LOGO_TYPES[file.type]
    if (!ext) return NextResponse.json({ error: 'unsupported_type' }, { status: 422 })
    if (file.size > MAX_LOGO_BYTES) return NextResponse.json({ error: 'file_too_large' }, { status: 422 })

    const admin = await createServerSupabase(true)
    const path = `${orgId}/logo.${ext}`
    const { error: upErr } = await admin.storage
      .from('logos')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (upErr) return NextResponse.json({ error: 'upload_failed', detail: upErr.message }, { status: 400 })

    const { data: pub } = admin.storage.from('logos').getPublicUrl(path)
    const url = `${pub.publicUrl}?v=${Date.now()}`

    const { error: dbErr } = await admin.from('organizations').update({ logo_url: url }).eq('id', orgId)
    if (dbErr) return NextResponse.json({ error: 'update_failed', detail: dbErr.message }, { status: 400 })

    return NextResponse.json({ success: true, url })
  } catch (err) {
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { orgId } = await req.json()
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    if (!(await assertOrgAdmin(supabase, user.id, orgId)))
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const admin = await createServerSupabase(true)
    const { error: dbErr } = await admin.from('organizations').update({ logo_url: null }).eq('id', orgId)
    if (dbErr) return NextResponse.json({ error: 'update_failed', detail: dbErr.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
