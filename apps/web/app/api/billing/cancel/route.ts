import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { orgId } = await req.json()
    if (!orgId) return NextResponse.json({ error: 'missing_org_id' }, { status: 400 })

    const admin = getAdmin()

    // Verify caller is owner or admin of the org
    const { data: member } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Fetch stripe subscription id
    const { data: org } = await admin
      .from('organizations')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', orgId)
      .single()

    if (!org?.stripe_subscription_id) {
      // No active Stripe subscription — just mark as canceled in DB
      const now = new Date()
      const deletion = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
      await admin.from('organizations').update({
        subscription_status: 'canceled',
        current_period_end: now.toISOString(),
        deletion_scheduled_at: deletion.toISOString(),
        expiry_notified_at: now.toISOString(),
      }).eq('id', orgId)

      return NextResponse.json({ ok: true, method: 'db_only' })
    }

    // Cancel via Stripe at period end
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })
    await stripe.subscriptions.update(org.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    return NextResponse.json({ ok: true, method: 'stripe' })
  } catch (err) {
    console.error('[billing/cancel]', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
