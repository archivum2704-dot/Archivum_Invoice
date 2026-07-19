import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdminClient()
  const { data: profile } = await admin.from('profiles').select('platform_role').eq('id', user.id).single()
  return profile?.platform_role === 'super_admin' ? user : null
}

/**
 * GET /api/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Aggregate-only platform stats for the super-admin panel. Returns counts
 * bucketed per organization and per month — never the underlying records
 * (no invoice numbers, clients, product names, prices...).
 *
 * - invoices: issued invoices bucketed by org + issue month, filtered by from/to
 * - products: current inventory size per org (not date-filtered) plus
 *   new products bucketed by org + creation month, filtered by from/to
 */
export async function GET(req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') // YYYY-MM-DD
  const to   = searchParams.get('to')

  const admin = getAdminClient()

  let invQ = admin.from('invoices').select('organization_id, issue_date, state, total')
  if (from) invQ = invQ.gte('issue_date', from)
  if (to)   invQ = invQ.lte('issue_date', to)

  const [orgsResult, invoicesResult, productsResult] = await Promise.all([
    admin.from('organizations').select('id, name'),
    invQ,
    admin.from('products').select('organization_id, is_active, created_at'),
  ])

  if (orgsResult.error)     console.error('[admin/stats] orgs query error:', orgsResult.error.message)
  if (invoicesResult.error) console.error('[admin/stats] invoices query error:', invoicesResult.error.message)
  if (productsResult.error) console.error('[admin/stats] products query error:', productsResult.error.message)

  const orgs     = orgsResult.data     ?? []
  const invoices = invoicesResult.data ?? []
  const products = productsResult.data ?? []

  // ── Issued invoices per org + month ──────────────────────────────────────
  const invoiceBuckets = new Map<string, { organization_id: string; month: string; count: number; total: number }>()
  for (const inv of invoices) {
    if (inv.state !== 'issued') continue
    const month = (inv.issue_date ?? '').slice(0, 7)
    if (!month) continue
    const key = `${inv.organization_id}|${month}`
    const b = invoiceBuckets.get(key) ?? { organization_id: inv.organization_id, month, count: 0, total: 0 }
    b.count += 1
    b.total += Number(inv.total ?? 0)
    invoiceBuckets.set(key, b)
  }

  // ── Current inventory size per org (active vs hidden) ────────────────────
  const inventoryByOrg = new Map<string, { organization_id: string; active: number; hidden: number }>()
  // ── New products per org + creation month (respects from/to) ─────────────
  const productBuckets = new Map<string, { organization_id: string; month: string; count: number }>()
  for (const p of products) {
    const t = inventoryByOrg.get(p.organization_id) ?? { organization_id: p.organization_id, active: 0, hidden: 0 }
    if (p.is_active === false) t.hidden += 1
    else t.active += 1
    inventoryByOrg.set(p.organization_id, t)

    const createdDay = (p.created_at ?? '').slice(0, 10)
    if (!createdDay) continue
    if (from && createdDay < from) continue
    if (to && createdDay > to) continue
    const month = createdDay.slice(0, 7)
    const key = `${p.organization_id}|${month}`
    const b = productBuckets.get(key) ?? { organization_id: p.organization_id, month, count: 0 }
    b.count += 1
    productBuckets.set(key, b)
  }

  return NextResponse.json({
    orgs,
    invoicesByOrgMonth: Array.from(invoiceBuckets.values()),
    inventoryByOrg:     Array.from(inventoryByOrg.values()),
    newProductsByOrgMonth: Array.from(productBuckets.values()),
  })
}
