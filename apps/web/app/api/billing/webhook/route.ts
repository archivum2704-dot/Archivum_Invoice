import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getStripe, PRICES } from '@/lib/stripe'
import { ADDONS, PLANS, type PlanId } from '@/lib/pricing'
import type Stripe from 'stripe'

// Do NOT wrap in createClient() — webhook uses raw body, no user session
function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function getOrgId(admin: ReturnType<typeof getAdmin>, customerId: string, metaOrgId?: string | null) {
  if (metaOrgId) return metaOrgId
  const { data } = await admin.from('organizations').select('id').eq('stripe_customer_id', customerId).single()
  return data?.id ?? null
}

/**
 * Recarga el cupo de documentos (organizations.doc_quota_pool).
 *
 * El cupo es una bolsa que se gasta al subir documentos (trigger
 * decrement_quota_pool) y que el trigger enforce_doc_quota usa para bloquear
 * subidas al llegar a 0. Nada la recargaba: ni la contratación ni las
 * renovaciones llamaban a renew_doc_quota, así que toda organización se
 * quedaba con los 20 documentos iniciales aunque pagara Pro.
 */
async function topUpDocs(admin: ReturnType<typeof getAdmin>, orgId: string, docs: number) {
  if (!(docs > 0)) return
  const { error } = await admin.rpc('renew_doc_quota', { p_org_id: orgId, p_monthly_docs: docs })
  if (error) console.error('[webhook] renew_doc_quota', orgId, error)
}

function monthlyDocs(plan: string | null | undefined) {
  return plan && plan in PLANS ? PLANS[plan as PlanId].docsPerMonth : 0
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  const admin = getAdmin()

  // Idempotency — skip if already processed
  const { error: dupErr } = await admin.from('billing_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object as any,
  })
  if (dupErr?.code === '23505') {
    // Unique constraint violation — already processed
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break
        const orgId = await getOrgId(admin, session.customer as string, session.metadata?.org_id)
        if (!orgId) break

        const sub = await getStripe().subscriptions.retrieve(session.subscription as string) as any
        const trialEnd  = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null

        // Detect which base plan was purchased
        const checkoutPlanMap: Record<string, string> = {
          [PRICES.starter]:  'starter',
          [PRICES.business]: 'business',
          [PRICES.pro]:      'pro',
        }
        const checkoutPlanItem = sub.items.data.find(
          (i: any) => i.price.lookup_key && checkoutPlanMap[i.price.lookup_key]
        )
        const checkoutPlan = checkoutPlanItem?.price.lookup_key
          ? (checkoutPlanMap[checkoutPlanItem.price.lookup_key] ?? 'starter')
          : 'starter'

        await admin.from('organizations').update({
          stripe_customer_id:     session.customer as string,
          stripe_subscription_id: sub.id,
          subscription_status:    sub.status as any,
          subscription_plan:      checkoutPlan,
          trial_ends_at:          trialEnd,
          current_period_end:     periodEnd,
        }).eq('id', orgId)

        // First period (trial included): the plan's monthly documents plus
        // any bonus packs bought with it. Packs that live on the subscription
        // as an item are added by customer.subscription.updated (it compares
        // with extra_docs_quantity); only one-off packs are counted here, so
        // none is added twice.
        const packsOnSub = sub.items.data.some((i: any) => i.price.lookup_key === PRICES.extraDocs)
        const extraDocsPacks = packsOnSub ? 0 : (Number(session.metadata?.extra_docs ?? 0) || 0)
        await topUpDocs(admin, orgId, monthlyDocs(checkoutPlan) + extraDocsPacks * ADDONS.extraDocs.docs)

        // Update org_id on billing_events row
        await admin.from('billing_events').update({ organization_id: orgId }).eq('stripe_event_id', event.id)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any  // cast to any for cross-version Stripe field access
        const orgId = await getOrgId(admin, sub.customer as string, sub.metadata?.org_id)
        if (!orgId) break

        const extraUsersItem     = sub.items.data.find((i: any) => i.price.lookup_key === PRICES.extraUsers)
        const extraDocsItem      = sub.items.data.find((i: any) => i.price.lookup_key === PRICES.extraDocs)
        const extraCompaniesItem = sub.items.data.find((i: any) => i.price.lookup_key === PRICES.extraCompanies)

        // Detect active plan from subscription items
        const planMap: Record<string, string> = {
          [PRICES.starter]:  'starter',
          [PRICES.business]: 'business',
          [PRICES.pro]:      'pro',
        }
        const activePlanItem = sub.items.data.find((i: any) => i.price.lookup_key && planMap[i.price.lookup_key])
        const detectedPlan   = activePlanItem?.price.lookup_key
          ? (planMap[activePlanItem.price.lookup_key] ?? null)
          : null

        const update: Record<string, any> = {
          subscription_status:       sub.status,
          current_period_end:        sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          extra_users_quantity:      extraUsersItem?.quantity     ?? 0,
          extra_docs_quantity:       extraDocsItem?.quantity      ?? 0,
          extra_companies_quantity:  extraCompaniesItem?.quantity ?? 0,
          ...(detectedPlan && { subscription_plan: detectedPlan }),
        }
        if (sub.trial_end) update.trial_ends_at = new Date(sub.trial_end * 1000).toISOString()

        // Bonus packs bought later (update-addons) arrive as a higher quantity
        // on the subscription: add only the packs that are new.
        const { data: before } = await admin.from('organizations').select('extra_docs_quantity').eq('id', orgId).single()
        const newPacks = (extraDocsItem?.quantity ?? 0) - (before?.extra_docs_quantity ?? 0)

        if (event.type === 'customer.subscription.deleted') {
          update.stripe_subscription_id = null
          update.subscription_status    = 'canceled'
        }

        await admin.from('organizations').update(update).eq('id', orgId)
        if (event.type === 'customer.subscription.updated') {
          await topUpDocs(admin, orgId, newPacks * ADDONS.extraDocs.docs)
        }
        await admin.from('billing_events').update({ organization_id: orgId }).eq('stripe_event_id', event.id)
        break
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice
        const orgId = await getOrgId(admin, inv.customer as string)
        if (!orgId) break
        const periodEnd = inv.lines.data[0]?.period?.end
          ? new Date(inv.lines.data[0].period.end * 1000).toISOString()
          : null
        await admin.from('organizations').update({
          subscription_status: 'active',
          ...(periodEnd && { current_period_end: periodEnd }),
        }).eq('id', orgId)

        // Each renewal adds the plan's monthly documents (unused ones carry
        // over). The first period is topped up on checkout.session.completed.
        if (inv.billing_reason === 'subscription_cycle') {
          const { data: org } = await admin.from('organizations').select('subscription_plan').eq('id', orgId).single()
          await topUpDocs(admin, orgId, monthlyDocs(org?.subscription_plan))
        }
        await admin.from('billing_events').update({ organization_id: orgId }).eq('stripe_event_id', event.id)
        break
      }

      case 'invoice.payment_failed':
      case 'invoice.payment_action_required': {
        const inv = event.data.object as Stripe.Invoice
        const orgId = await getOrgId(admin, inv.customer as string)
        if (!orgId) break
        await admin.from('organizations').update({ subscription_status: 'past_due' }).eq('id', orgId)
        await admin.from('billing_events').update({ organization_id: orgId }).eq('stripe_event_id', event.id)
        break
      }

      default:
        // Unhandled event type — safe to ignore
        break
    }
  } catch (err) {
    console.error(`[webhook] error handling ${event.type}:`, err)
    // Return 200 so Stripe doesn't retry — log it for investigation
  }

  return NextResponse.json({ received: true })
}
