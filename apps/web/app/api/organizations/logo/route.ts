import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

// Client-side uploads straight to Supabase Storage run under the
// browser's session, which for this app's cookie-based auth doesn't
// reliably attach as `authenticated` to the Storage API — it lands as
// `anon` and gets rejected by RLS. Route the upload through the
// server (cookie-authenticated) instead, matching how every other
// storage write in this app already works (see /api/invoices/issue).
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

    const ext = ALLOWED_LOGO_TYPES[file.type]
    if (!ext) return NextResponse.json({ error: 'unsupported_type' }, { status: 422 })
    if (file.size > MAX_LOGO_BYTES) return NextResponse.json({ error: 'file_too_large' }, { status: 422 })

    const path = `${orgId}/logo.${ext}`
    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (upErr) return NextResponse.json({ error: 'upload_failed', detail: upErr.message }, { status: 400 })

    const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
    const url = `${pub.publicUrl}?v=${Date.now()}`

    const { error: dbErr } = await supabase.from('organizations').update({ logo_url: url }).eq('id', orgId)
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

    const { error: dbErr } = await supabase.from('organizations').update({ logo_url: null }).eq('id', orgId)
    if (dbErr) return NextResponse.json({ error: 'update_failed', detail: dbErr.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
