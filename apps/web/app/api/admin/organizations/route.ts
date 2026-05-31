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

export async function GET(_req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const admin = getAdminClient()

  const [{ data: orgs }, { data: members }, { data: docs }] = await Promise.all([
    admin.from('organizations').select(`
      id, name, slug, cif, is_active, created_at,
      subscription_plan, subscription_status, stripe_subscription_id, stripe_customer_id,
      extra_users_quantity, extra_docs_quantity, doc_quota_pool,
      current_period_end, trial_ends_at, deletion_scheduled_at,
      storage_limit_bytes, storage_used_bytes
    `).order('created_at', { ascending: false }),
    admin.from('organization_members').select('organization_id, user_id, role, profiles(email, first_name, last_name)'),
    admin.from('documents').select('organization_id'),
  ])

  const membersByOrg = new Map<string, typeof members>()
  for (const m of members ?? []) {
    const arr = membersByOrg.get(m.organization_id) ?? []
    arr.push(m as any)
    membersByOrg.set(m.organization_id, arr as any)
  }

  const docCountByOrg = new Map<string, number>()
  for (const d of docs ?? []) {
    docCountByOrg.set(d.organization_id, (docCountByOrg.get(d.organization_id) ?? 0) + 1)
  }

  const result = (orgs ?? []).map(org => {
    const orgMembers = (membersByOrg.get(org.id) ?? []) as any[]
    const owner = orgMembers.find((m: any) => m.role === 'owner')
    return {
      ...org,
      member_count: orgMembers.length,
      document_count: docCountByOrg.get(org.id) ?? 0,
      owner_email: (owner?.profiles as any)?.email ?? null,
    }
  })

  return NextResponse.json(result)
}
