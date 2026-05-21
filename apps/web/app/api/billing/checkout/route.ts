import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getStripe, PRICES } from '@/lib/stripe'
import type { PlanId } from '@/lib/pricing'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://archivum2704-dot.vercel.app'

// Map PlanId → Stripe lookup key
const PLAN_PRICE_KEY: Record<Exclude<PlanId, 'free'>, string> = {
  starter:  PRICES.starter,
  business: PRICES.business,
  pro:      PRICES.pro,
}

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, planId = 'starter', extraUsers = 0, extraDocs = 0 } = await req.json() as {
      orgId: string; planId?: PlanId; extraUsers?: number; extraDocs?: number
    }
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })
    if (planId === 'free' || !PLAN_PRICE_KEY[planId as Exclude<PlanId, 'free'>]) {
      return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })
    }

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
    if (org.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(org.subscription_status ?? '')) {
      return NextResponse.json({ error: 'already_subscribed' }, { status: 409 })
    }

    // Get or create Stripe customer
    let customerId = org.stripe_customer_id
    if (!customerId) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single()
      const customer = await getStripe().customers.create({
        email: profile?.email ?? user.email,
        name: org.name,
        metadata: { org_id: orgId },
      })
      customerId = customer.id
      await admin.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
    }

    const stripe   = getStripe()
    const lookupKey = PLAN_PRICE_KEY[planId as Exclude<PlanId, 'free'>]

    // Fetch base plan price
    const [basePrice, usersPrice, docsPrice] = await Promise.all([
      stripe.prices.list({ lookup_keys: [lookupKey],          limit: 1 }),
      stripe.prices.list({ lookup_keys: [PRICES.extraUsers],  limit: 1 }),
      stripe.prices.list({ lookup_keys: [PRICES.extraDocs],   limit: 1 }),
    ])

    if (!basePrice.data[0]) {
      return NextResponse.json({ error: 'stripe_price_not_found', detail: lookupKey }, { status: 500 })
    }

    const lineItems: { price: string; quantity: number }[] = [
      { price: basePrice.data[0].id, quantity: 1 },
    ]

    // Extras: use values passed from the UI, or fall back to previously purchased quantities
    const { data: orgExtras } = await admin
      .from('organizations')
      .select('extra_users_quantity, extra_docs_quantity')
      .eq('id', orgId)
      .single()

    const finalExtraUsers = extraUsers > 0 ? extraUsers : (orgExtras?.extra_users_quantity ?? 0)
    const finalExtraDocs  = extraDocs  > 0 ? extraDocs  : (orgExtras?.extra_docs_quantity  ?? 0)

    if (finalExtraUsers > 0 && usersPrice.data[0]) {
      lineItems.push({ price: usersPrice.data[0].id, quantity: finalExtraUsers })
    }
    if (finalExtraDocs > 0 && docsPrice.data[0]) {
      lineItems.push({ price: docsPrice.data[0].id, quantity: finalExtraDocs })
    }

    // First-time subscription → 7-day trial
    const isFirstTime = !org.stripe_subscription_id
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      ...(isFirstTime && {
        subscription_data: {
          trial_period_days: 7,
          metadata: { org_id: orgId, plan_id: planId },
        },
      }),
      metadata: { org_id: orgId, plan_id: planId },
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
