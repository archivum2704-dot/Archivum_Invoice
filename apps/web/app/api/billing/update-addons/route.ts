import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe, PRICES } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { orgId, extraUsers, extraDocs } = await req.json()
    if (!orgId || extraUsers == null || extraDocs == null) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }
    if (extraUsers < 0 || extraDocs < 0) {
      return NextResponse.json({ error: 'invalid_quantity' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'not_authorized' }, { status: 403 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: org } = await admin
      .from('organizations')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', orgId)
      .single()

    if (!org?.stripe_subscription_id) {
      return NextResponse.json({ error: 'no_subscription' }, { status: 400 })
    }
    if (!['active', 'trialing'].includes(org.subscription_status)) {
      return NextResponse.json({ error: 'subscription_not_active' }, { status: 400 })
    }

    // Get current subscription items
    const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id)

    // Fetch price IDs by lookup key
    const [usersPrice, docsPrice] = await Promise.all([
      stripe.prices.list({ lookup_keys: [PRICES.extraUsers], limit: 1 }),
      stripe.prices.list({ lookup_keys: [PRICES.extraDocs],  limit: 1 }),
    ])

    const items: { id?: string; price?: string; quantity: number; deleted?: boolean }[] = []

    const existingUsersItem = sub.items.data.find(i => i.price.lookup_key === PRICES.extraUsers)
    const existingDocsItem  = sub.items.data.find(i => i.price.lookup_key === PRICES.extraDocs)

    // Extra users
    if (extraUsers > 0) {
      if (existingUsersItem) {
        items.push({ id: existingUsersItem.id, quantity: extraUsers })
      } else if (usersPrice.data[0]) {
        items.push({ price: usersPrice.data[0].id, quantity: extraUsers })
      }
    } else if (existingUsersItem) {
      items.push({ id: existingUsersItem.id, deleted: true })
    }

    // Extra docs
    if (extraDocs > 0) {
      if (existingDocsItem) {
        items.push({ id: existingDocsItem.id, quantity: extraDocs })
      } else if (docsPrice.data[0]) {
        items.push({ price: docsPrice.data[0].id, quantity: extraDocs })
      }
    } else if (existingDocsItem) {
      items.push({ id: existingDocsItem.id, deleted: true })
    }

    if (items.length === 0) {
      return NextResponse.json({ ok: true, changed: false })
    }

    await stripe.subscriptions.update(org.stripe_subscription_id, {
      items,
      proration_behavior: 'always_invoice',
    })

    // DB sync happens via webhook (customer.subscription.updated)
    return NextResponse.json({ ok: true, changed: true })
  } catch (err) {
    console.error('[billing/update-addons]', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
