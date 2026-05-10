import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeLimits } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // Any member can read billing status
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

    const { data: org } = await supabase
      .from('organizations')
      .select(`
        subscription_status, trial_ends_at, current_period_end,
        extra_users_quantity, extra_docs_quantity, document_count,
        stripe_customer_id, stripe_subscription_id
      `)
      .eq('id', orgId)
      .single()

    if (!org) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })

    // Current member count
    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    const { maxUsers, maxDocs } = computeLimits(
      org.extra_users_quantity,
      org.extra_docs_quantity,
    )

    return NextResponse.json({
      subscriptionStatus:   org.subscription_status,
      trialEndsAt:          org.trial_ends_at,
      currentPeriodEnd:     org.current_period_end,
      extraUsersQuantity:   org.extra_users_quantity,
      extraDocsQuantity:    org.extra_docs_quantity,
      documentCount:        org.document_count,
      memberCount:          memberCount ?? 0,
      maxUsers,
      maxDocs,
      hasSubscription:      !!org.stripe_subscription_id,
      hasCustomer:          !!org.stripe_customer_id,
      isAdmin:              ['owner', 'admin'].includes(member.role),
    })
  } catch (err) {
    console.error('[billing/status]', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
