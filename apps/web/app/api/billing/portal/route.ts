import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://archivum2704-dot.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json()
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
      .select('stripe_customer_id')
      .eq('id', orgId)
      .single()

    if (!org?.stripe_customer_id) {
      return NextResponse.json({ error: 'no_subscription' }, { status: 400 })
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${APP_URL}/configuracion/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[billing/portal]', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
