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

  const [orgsResult, membersResult, docsResult] = await Promise.all([
    admin.from('organizations').select('*').order('created_at', { ascending: false }),
    admin.from('organization_members').select('organization_id, user_id, role, profiles(email, first_name, last_name)'),
    admin.from('documents').select('organization_id'),
  ])

  // Log errors for debugging but don't fail silently
  if (orgsResult.error)    console.error('[admin/orgs] orgs query error:', orgsResult.error.message)
  if (membersResult.error) console.error('[admin/orgs] members query error:', membersResult.error.message)
  if (docsResult.error)    console.error('[admin/orgs] docs query error:', docsResult.error.message)

  const orgs    = orgsResult.data    ?? []
  const members = membersResult.data ?? []
  const docs    = docsResult.data    ?? []

  const membersByOrg = new Map<string, any[]>()
  for (const m of members) {
    const arr = membersByOrg.get(m.organization_id) ?? []
    arr.push(m)
    membersByOrg.set(m.organization_id, arr)
  }

  const docCountByOrg = new Map<string, number>()
  for (const d of docs) {
    docCountByOrg.set(d.organization_id, (docCountByOrg.get(d.organization_id) ?? 0) + 1)
  }

  const result = orgs.map((org: any) => {
    const orgMembers = membersByOrg.get(org.id) ?? []
    const owner = orgMembers.find((m: any) => m.role === 'owner')
    return {
      ...org,
      // Normalise billing fields that may not exist in older DB schemas
      subscription_plan:      org.subscription_plan      ?? 'free',
      subscription_status:    org.subscription_status    ?? null,
      stripe_subscription_id: org.stripe_subscription_id ?? null,
      stripe_customer_id:     org.stripe_customer_id     ?? null,
      extra_users_quantity:   org.extra_users_quantity   ?? 0,
      extra_docs_quantity:    org.extra_docs_quantity     ?? 0,
      doc_quota_pool:         org.doc_quota_pool          ?? 0,
      current_period_end:     org.current_period_end      ?? null,
      trial_ends_at:          org.trial_ends_at            ?? null,
      deletion_scheduled_at:  org.deletion_scheduled_at   ?? null,
      storage_limit_bytes:    org.storage_limit_bytes      ?? 0,
      storage_used_bytes:     org.storage_used_bytes       ?? 0,
      member_count:           orgMembers.length,
      document_count:         docCountByOrg.get(org.id)   ?? 0,
      owner_email:            (owner?.profiles as any)?.email ?? null,
    }
  })

  return NextResponse.json(result)
}
