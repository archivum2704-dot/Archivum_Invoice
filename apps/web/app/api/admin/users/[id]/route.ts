import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdminClient()
  const { data: profile } = await admin.from('profiles').select('platform_role').eq('id', user.id).single()
  return profile?.platform_role === 'super_admin' ? user : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  // Prevent self-demotion from super_admin
  if (params.id === caller.id) {
    const body = await req.json()
    if (body.platform_role && body.platform_role !== 'super_admin') {
      return NextResponse.json({ error: 'cannot_demote_self' }, { status: 400 })
    }
  }

  const body = await req.json()
  const allowed = ['first_name', 'last_name', 'platform_role']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { error } = await admin.from('profiles').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireSuperAdmin()
  if (!caller) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  if (params.id === caller.id) {
    return NextResponse.json({ error: 'cannot_delete_self' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Remove from all orgs
  await admin.from('organization_members').delete().eq('user_id', params.id)

  // Delete auth user (cascades to profile via DB trigger if set, otherwise also delete profile)
  const { error } = await admin.auth.admin.deleteUser(params.id)
  if (error) {
    // Fallback: delete profile manually
    await admin.from('profiles').delete().eq('id', params.id)
  }

  return NextResponse.json({ success: true })
}
