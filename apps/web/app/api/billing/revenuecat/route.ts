import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { ADDONS, PLANS } from '@/lib/pricing'
import { isDocsPackProduct, planForStoreProduct, type BillingStore } from '@/lib/store-billing'

/**
 * POST /api/billing/revenuecat — avisos de RevenueCat sobre las compras hechas
 * en las apps (App Store y Google Play).
 *
 * Hace con las tiendas lo mismo que /api/billing/webhook hace con Stripe:
 * escribe el plan en `organizations` y recarga el cupo de documentos.
 *
 * - En las apps, el comprador se identifica en RevenueCat con el **id de la
 *   organización** (`Purchases.logIn(orgId)`), así que `app_user_id` es el id
 *   de la organización.
 * - RevenueCat manda en la cabecera Authorization el valor que se configura en
 *   su panel; aquí se compara con REVENUECAT_WEBHOOK_SECRET (falla cerrado si
 *   falta, como CRON_SECRET).
 * - Las compras de prueba (sandbox: TestFlight, testers con licencia de Google)
 *   no dan ningún plan salvo con REVENUECAT_ACCEPT_SANDBOX=true. Si no, una
 *   compra de TestFlight, que no cuesta nada, activaría Pro de verdad.
 * - Cuando la suscripción de la tienda caduca, la organización vuelve al
 *   Gratuito con estado `active`, como al acabar la prueba de 30 días; no
 *   `canceled`, que haría que (protected)/layout.tsx programara el borrado de
 *   los datos.
 */

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function authorized(header: string | null): boolean {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET
  if (!secret || !header) return false
  const given = header.replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(secret.replace(/^Bearer\s+/i, ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RcEvent = {
  id: string
  type: string
  app_user_id?: string
  original_app_user_id?: string
  aliases?: string[]
  product_id?: string
  new_product_id?: string
  store?: string
  environment?: string
  expiration_at_ms?: number | null
  original_transaction_id?: string
}

function storeOf(event: RcEvent): BillingStore | null {
  if (event.store === 'APP_STORE' || event.store === 'MAC_APP_STORE') return 'app_store'
  if (event.store === 'PLAY_STORE') return 'play_store'
  return null
}

/** El id de la organización entre los identificadores del comprador. */
function orgIdOf(event: RcEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])]
  return candidates.find(c => !!c && UUID.test(c)) ?? null
}

export async function POST(req: NextRequest) {
  if (!authorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let event: RcEvent
  try {
    const body = await req.json()
    event = body?.event
    if (!event?.id || !event?.type) throw new Error('no event')
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // El botón «Send test event» del panel de RevenueCat.
  if (event.type === 'TEST') return NextResponse.json({ received: true, test: true })

  if (event.environment === 'SANDBOX' && process.env.REVENUECAT_ACCEPT_SANDBOX !== 'true') {
    return NextResponse.json({ received: true, ignored: 'sandbox' })
  }

  const admin = getAdmin()

  // Idempotencia: misma tabla que Stripe, con prefijo para no chocar.
  const { error: dupErr } = await admin.from('billing_events').insert({
    stripe_event_id: `revenuecat:${event.id}`,
    event_type: `revenuecat.${event.type}`,
    payload: event as any,
  })
  if (dupErr?.code === '23505') return NextResponse.json({ received: true, duplicate: true })

  const orgId = orgIdOf(event)
  if (!orgId) {
    console.error('[revenuecat] sin id de organización', event.id, event.app_user_id)
    return NextResponse.json({ received: true, ignored: 'no_org' })
  }

  const { data: org } = await admin
    .from('organizations')
    .select('id, subscription_plan, subscription_status, stripe_subscription_id, billing_store')
    .eq('id', orgId)
    .maybeSingle()
  if (!org) {
    console.error('[revenuecat] organización inexistente', orgId)
    return NextResponse.json({ received: true, ignored: 'unknown_org' })
  }
  await admin.from('billing_events').update({ organization_id: orgId }).eq('stripe_event_id', `revenuecat:${event.id}`)

  const store = storeOf(event)
  const periodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null
  const topUp = async (docs: number) => {
    if (!(docs > 0)) return
    const { error } = await admin.rpc('renew_doc_quota', { p_org_id: orgId, p_monthly_docs: docs })
    if (error) console.error('[revenuecat] renew_doc_quota', orgId, error)
  }

  try {
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION': {
        const plan = planForStoreProduct(event.product_id)
        if (!plan) break
        if (org.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(org.subscription_status ?? '')) {
          // No debería pasar: la app no deja comprar si ya se paga en la web.
          console.warn('[revenuecat] la organización ya tiene suscripción de Stripe', orgId, event.id)
        }
        await admin.from('organizations').update({
          subscription_plan: plan,
          subscription_status: 'active',
          current_period_end: periodEnd,
          billing_store: store,
          store_product_id: event.product_id ?? null,
          store_original_transaction_id: event.original_transaction_id ?? null,
        }).eq('id', orgId)
        // Mismo criterio que Stripe: el mes del plan al contratar y en cada
        // renovación (lo que no se gasta se acumula).
        if (event.type !== 'UNCANCELLATION') await topUp(PLANS[plan].docsPerMonth)
        break
      }

      case 'PRODUCT_CHANGE':
        // Un cambio de plan en la tienda. El plan nuevo llega con la compra o
        // la renovación que lo hace efectivo (product_id del evento siguiente);
        // aquí solo queda registrado en billing_events.
        break

      case 'CANCELLATION':
        // Se ha desactivado la renovación: el plan sigue hasta current_period_end
        // y entonces llega EXPIRATION.
        break

      case 'BILLING_ISSUE':
        if (org.billing_store) {
          await admin.from('organizations').update({ subscription_status: 'past_due' }).eq('id', orgId)
        }
        break

      case 'EXPIRATION': {
        // Solo si la suscripción vigente es la de la tienda; si mientras tanto
        // se contrató en la web, no se toca.
        if (!org.billing_store) break
        await admin.from('organizations').update({
          subscription_plan: 'free',
          subscription_status: 'active',
          billing_store: null,
          store_product_id: null,
          store_original_transaction_id: null,
        }).eq('id', orgId)
        break
      }

      case 'NON_RENEWING_PURCHASE':
        if (isDocsPackProduct(event.product_id)) await topUp(ADDONS.extraDocs.docs)
        break

      default:
        // TRANSFER, SUBSCRIPTION_PAUSED, etc.: solo quedan registrados.
        break
    }
  } catch (err) {
    console.error('[revenuecat] error procesando', event.type, event.id, err)
    // Sin esto, el reintento de RevenueCat se tomaría por duplicado y se perdería.
    await admin.from('billing_events').delete().eq('stripe_event_id', `revenuecat:${event.id}`)
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
