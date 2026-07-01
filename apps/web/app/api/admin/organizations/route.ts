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

export async function GET(_req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const admin = getAdminClient()

  const [orgsResult, membersResult, docsResult, invoicesResult, companiesResult, productsResult, certsResult] = await Promise.all([
    admin.from('organizations').select('*').order('created_at', { ascending: false }),
    admin.from('organization_members').select('organization_id, user_id, role, profiles(email, first_name, last_name)'),
    admin.from('documents').select('organization_id, file_size'),
    admin.from('invoices').select('organization_id, state, total'),
    admin.from('companies').select('organization_id, is_active'),
    admin.from('products').select('organization_id, is_active'),
    // VeriFactu certificate metadata only — never the sealed secret
    admin.from('org_certificates').select('organization_id, nif, valid_until, uploaded_at'),
  ])

  // Log errors for debugging but don't fail silently
  if (orgsResult.error)      console.error('[admin/orgs] orgs query error:', orgsResult.error.message)
  if (membersResult.error)   console.error('[admin/orgs] members query error:', membersResult.error.message)
  if (docsResult.error)      console.error('[admin/orgs] docs query error:', docsResult.error.message)
  if (invoicesResult.error)  console.error('[admin/orgs] invoices query error:', invoicesResult.error.message)
  if (companiesResult.error) console.error('[admin/orgs] companies query error:', companiesResult.error.message)
  if (productsResult.error)  console.error('[admin/orgs] products query error:', productsResult.error.message)
  if (certsResult.error)     console.error('[admin/orgs] certificates query error:', certsResult.error.message)

  const orgs      = orgsResult.data      ?? []
  const members   = membersResult.data   ?? []
  const docs      = docsResult.data      ?? []
  const invoices  = invoicesResult.data  ?? []
  const companies = companiesResult.data ?? []
  const products  = productsResult.data  ?? []
  const certs     = certsResult.data     ?? []

  const membersByOrg = new Map<string, any[]>()
  for (const m of members) {
    const arr = membersByOrg.get(m.organization_id) ?? []
    arr.push(m)
    membersByOrg.set(m.organization_id, arr)
  }

  const docCountByOrg = new Map<string, number>()
  const storageByOrg = new Map<string, number>()
  for (const d of docs) {
    docCountByOrg.set(d.organization_id, (docCountByOrg.get(d.organization_id) ?? 0) + 1)
    // Compute real storage from each document's file_size — robust against the
    // storage_used_bytes trigger not being applied in some environments
    const size = (d as any).file_size ?? 0
    storageByOrg.set(d.organization_id, (storageByOrg.get(d.organization_id) ?? 0) + size)
  }

  // Issued-invoice count + total invoiced amount per org (VeriFactu / Facturación)
  const invoiceCountByOrg = new Map<string, number>()
  const invoicedTotalByOrg = new Map<string, number>()
  for (const inv of invoices) {
    if (inv.state !== 'issued') continue
    invoiceCountByOrg.set(inv.organization_id, (invoiceCountByOrg.get(inv.organization_id) ?? 0) + 1)
    invoicedTotalByOrg.set(inv.organization_id, (invoicedTotalByOrg.get(inv.organization_id) ?? 0) + Number(inv.total ?? 0))
  }

  // Active clients + catalog products per org
  const companyCountByOrg = new Map<string, number>()
  for (const c of companies) {
    if (c.is_active === false) continue
    companyCountByOrg.set(c.organization_id, (companyCountByOrg.get(c.organization_id) ?? 0) + 1)
  }
  const productCountByOrg = new Map<string, number>()
  for (const p of products) {
    if (p.is_active === false) continue
    productCountByOrg.set(p.organization_id, (productCountByOrg.get(p.organization_id) ?? 0) + 1)
  }

  // VeriFactu certificate by org (metadata only)
  const certByOrg = new Map<string, { nif: string | null; valid_until: string | null; uploaded_at: string | null }>()
  for (const c of certs as any[]) {
    certByOrg.set(c.organization_id, { nif: c.nif ?? null, valid_until: c.valid_until ?? null, uploaded_at: c.uploaded_at ?? null })
  }

  const result = orgs.map((org: any) => {
    const orgMembers = membersByOrg.get(org.id) ?? []
    const owner = orgMembers.find((m: any) => m.role === 'owner')
    return {
      ...org,
      // Normalise billing fields that may not exist in older DB schemas
      subscription_plan:      org.subscription_plan      ?? 'free',
      subscription_status:    org.subscription_status    ?? null,
      stripe_subscription_id: org.stripe_subscription_id ?? null,
      stripe_customer_id:     org.stripe_customer_id     ?? null,
      extra_users_quantity:   org.extra_users_quantity   ?? 0,
      extra_docs_quantity:    org.extra_docs_quantity     ?? 0,
      doc_quota_pool:         org.doc_quota_pool          ?? 0,
      current_period_end:     org.current_period_end      ?? null,
      trial_ends_at:          org.trial_ends_at            ?? null,
      deletion_scheduled_at:  org.deletion_scheduled_at   ?? null,
      storage_limit_bytes:    org.storage_limit_bytes      ?? 0,
      // Prefer the real computed sum from documents; fall back to the stored column
      storage_used_bytes:     storageByOrg.get(org.id)     ?? org.storage_used_bytes ?? 0,
      member_count:           orgMembers.length,
      document_count:         docCountByOrg.get(org.id)   ?? 0,
      invoice_count:          invoiceCountByOrg.get(org.id)  ?? 0,
      invoiced_total:         invoicedTotalByOrg.get(org.id) ?? 0,
      company_count:          companyCountByOrg.get(org.id)  ?? 0,
      product_count:          productCountByOrg.get(org.id)  ?? 0,
      cert_exists:            certByOrg.has(org.id),
      cert_nif:               certByOrg.get(org.id)?.nif         ?? null,
      cert_valid_until:       certByOrg.get(org.id)?.valid_until ?? null,
      cert_uploaded_at:       certByOrg.get(org.id)?.uploaded_at ?? null,
      owner_email:            (owner?.profiles as any)?.email ?? null,
    }
  })

  return NextResponse.json(result)
}
