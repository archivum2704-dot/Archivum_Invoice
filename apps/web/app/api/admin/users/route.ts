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

  const [{ data: profiles }, { data: memberships }] = await Promise.all([
    admin.from('profiles').select('id, email, first_name, last_name, platform_role, created_at').order('created_at', { ascending: false }),
    admin.from('organization_members').select('user_id, role, organizations(id, name, subscription_plan)'),
  ])

  const membershipsByUser = new Map<string, Array<{ org_id: string; org_name: string; role: string; subscription_plan: string }>>()
  for (const m of memberships ?? []) {
    const arr = membershipsByUser.get(m.user_id) ?? []
    const org = m.organizations as any
    arr.push({
      org_id: org?.id ?? '',
      org_name: org?.name ?? '—',
      role: m.role,
      subscription_plan: org?.subscription_plan ?? 'free',
    })
    membershipsByUser.set(m.user_id, arr)
  }

  const result = (profiles ?? []).map(p => ({
    ...p,
    orgs: membershipsByUser.get(p.id) ?? [],
  }))

  return NextResponse.json(result)
}
