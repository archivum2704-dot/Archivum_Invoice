import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeLimits, FREE_LIMITS } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

    // Count members, documents and companies directly (no migration dependency)
    const [{ count: memberCount }, { count: documentCount }, { count: companyCount }] = await Promise.all([
      supabase.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    ])

    // Try billing columns — may not exist if migration hasn't run
    const { data: org } = await supabase
      .from('organizations')
      .select(`
        subscription_status, trial_ends_at, current_period_end,
        extra_users_quantity, extra_docs_quantity, extra_companies_quantity,
        stripe_customer_id, stripe_subscription_id
      `)
      .eq('id', orgId)
      .single()

    const extraUsersQuantity     = org?.extra_users_quantity     ?? 0
    const extraDocsQuantity      = org?.extra_docs_quantity      ?? 0
    const extraCompaniesQuantity = org?.extra_companies_quantity ?? 0
    const hasSubscription        = !!org?.stripe_subscription_id
    const subscriptionStatus     = org?.subscription_status ?? null
    const isPaidActive = hasSubscription &&
      (subscriptionStatus === 'active' || subscriptionStatus === 'trialing')

    const { maxUsers, maxDocs, maxCompanies } = isPaidActive
      ? computeLimits(extraUsersQuantity, extraDocsQuantity, extraCompaniesQuantity)
      : { maxUsers: FREE_LIMITS.users, maxDocs: FREE_LIMITS.docs, maxCompanies: FREE_LIMITS.companies }

    return NextResponse.json({
      subscriptionStatus,
      trialEndsAt:             org?.trial_ends_at      ?? null,
      currentPeriodEnd:        org?.current_period_end ?? null,
      extraUsersQuantity,
      extraDocsQuantity,
      extraCompaniesQuantity,
      documentCount:           documentCount ?? 0,
      memberCount:             memberCount   ?? 0,
      companyCount:            companyCount  ?? 0,
      maxUsers,
      maxDocs,
      maxCompanies,
      hasSubscription,
      hasCustomer:             !!org?.stripe_customer_id,
      isAdmin:                 ['owner', 'admin'].includes(member.role),
    })
  } catch (err) {
    console.error('[billing/status]', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
