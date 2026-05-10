import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe, PRICES } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://archivum2704-dot.vercel.app'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json()
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // Only owner/admin can manage billing
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'not_authorized' }, { status: 403 })
    }

    const admin = getAdmin()
    const { data: org } = await admin
      .from('organizations')
      .select('name, stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', orgId)
      .single()

    if (!org) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })

    // Already has an active subscription — redirect to portal instead
    if (org.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(org.subscription_status)) {
      return NextResponse.json({ error: 'already_subscribed' }, { status: 409 })
    }

    // Get or create Stripe customer
    let customerId = org.stripe_customer_id
    if (!customerId) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single()
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email,
        name: org.name,
        metadata: { org_id: orgId },
      })
      customerId = customer.id
      await admin.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
    }

    // Build line items
    const lineItems: { price: string; quantity: number }[] = []

    // Fetch price IDs by lookup key
    const [basePrice, usersPrice, docsPrice] = await Promise.all([
      stripe.prices.list({ lookup_keys: [PRICES.base],       limit: 1 }),
      stripe.prices.list({ lookup_keys: [PRICES.extraUsers], limit: 1 }),
      stripe.prices.list({ lookup_keys: [PRICES.extraDocs],  limit: 1 }),
    ])

    if (!basePrice.data[0]) {
      return NextResponse.json({ error: 'stripe_price_not_found', detail: PRICES.base }, { status: 500 })
    }
    lineItems.push({ price: basePrice.data[0].id, quantity: 1 })

    // Extra users / docs added after subscription via update-addons
    // Include them in checkout only if org already had some (re-subscribe case)
    const { data: orgExtras } = await admin
      .from('organizations')
      .select('extra_users_quantity, extra_docs_quantity')
      .eq('id', orgId)
      .single()

    if (orgExtras?.extra_users_quantity && usersPrice.data[0]) {
      lineItems.push({ price: usersPrice.data[0].id, quantity: orgExtras.extra_users_quantity })
    }
    if (orgExtras?.extra_docs_quantity && docsPrice.data[0]) {
      lineItems.push({ price: docsPrice.data[0].id, quantity: orgExtras.extra_docs_quantity })
    }

    // First-time subscription → 14-day trial
    const isFirstTime = !org.stripe_subscription_id
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      ...(isFirstTime && { subscription_data: { trial_period_days: 14, metadata: { org_id: orgId } } }),
      metadata: { org_id: orgId },
      success_url: `${APP_URL}/configuracion/billing?success=1`,
      cancel_url:  `${APP_URL}/configuracion/billing`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'es',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
