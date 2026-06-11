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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  const { id } = await params

  const body = await req.json()
  const allowed = [
    'name', 'is_active', 'subscription_plan', 'subscription_status',
    'extra_users_quantity', 'extra_docs_quantity', 'doc_quota_pool',
    'current_period_end', 'stripe_subscription_id', 'stripe_customer_id',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { error } = await admin.from('organizations').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  const { id } = await params

  const admin = getAdminClient()

  // Get members before deleting to clean up orphaned auth users
  const { data: members } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', id)

  // Delete org (cascades to members, companies, documents if FK CASCADE is set)
  // We delete child tables explicitly for safety
  await Promise.all([
    admin.from('documents').delete().eq('organization_id', id),
    admin.from('companies').delete().eq('organization_id', id),
    admin.from('organization_members').delete().eq('organization_id', id),
  ])

  const { error } = await admin.from('organizations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Delete auth users who no longer belong to any org
  const userIds = [...new Set((members ?? []).map(m => m.user_id))]
  for (const uid of userIds) {
    const { count } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
    if ((count ?? 0) === 0) {
      await admin.auth.admin.deleteUser(uid)
    }
  }

  return NextResponse.json({ success: true })
}
