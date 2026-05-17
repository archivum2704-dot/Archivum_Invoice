import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLANS, type PlanId } from '@/lib/pricing'

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

    // Count members, documents and companies
    const [{ count: memberCount }, { count: documentCount }, { count: companyCount }] = await Promise.all([
      supabase.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    ])

    const { data: org } = await supabase
      .from('organizations')
      .select(`
        subscription_plan, subscription_status, trial_ends_at, current_period_end,
        extra_users_quantity, extra_docs_quantity, extra_companies_quantity,
        stripe_customer_id, stripe_subscription_id
      `)
      .eq('id', orgId)
      .single()

    const planId               = (org?.subscription_plan ?? 'free') as PlanId
    const plan                 = PLANS[planId] ?? PLANS.free
    const extraUsersQuantity   = org?.extra_users_quantity     ?? 0
    const extraDocsQuantity    = org?.extra_docs_quantity      ?? 0
    const extraCompaniesQuantity = org?.extra_companies_quantity ?? 0
    const hasSubscription      = !!org?.stripe_subscription_id
    const subscriptionStatus   = org?.subscription_status ?? null

    // User limit = plan base users + extra purchased
    const maxUsers = plan.users + extraUsersQuantity

    // Annual doc pool = plan yearly allowance + bonos (250 docs each)
    const maxDocs = plan.docsPerYear + extraDocsQuantity * 250

    // Legacy company limit (kept for DB compat; no longer sold as addon)
    const maxCompanies = 20 + extraCompaniesQuantity

    return NextResponse.json({
      plan: planId,
      subscriptionStatus,
      trialEndsAt:          org?.trial_ends_at      ?? null,
      currentPeriodEnd:     org?.current_period_end ?? null,
      extraUsersQuantity,
      extraDocsQuantity,
      extraCompaniesQuantity,
      documentCount:        documentCount ?? 0,
      memberCount:          memberCount   ?? 0,
      companyCount:         companyCount  ?? 0,
      maxUsers,
      maxDocs,
      maxCompanies,
      hasSubscription,
      hasCustomer:          !!org?.stripe_customer_id,
      isAdmin:              ['owner', 'admin'].includes(member.role),
    })
  } catch (err) {
    console.error('[billing/status]', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
