import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { open } from '@/lib/crypto-vault'
import { p12ToPem, buildEnvelope, submitToAeat, type AeatInvoice, type AeatLine, type AeatPrev } from '@/lib/verifactu-aeat'
import type { InvoiceKind } from '@/lib/verifactu'

export const runtime = 'nodejs'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service env')
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, invoiceId } = await req.json()
    if (!orgId || !invoiceId) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    // ── Authorize (org admin or platform admin) ─────────────
    const supabase = await getApiClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const db = admin()
    const { data: profile } = await db.from('profiles').select('platform_role').eq('id', user.id).single()
    if (profile?.platform_role !== 'super_admin') {
      const { data: m } = await db.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single()
      if (!m || !['owner', 'admin'].includes(m.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ── Load invoice + lines ────────────────────────────────
    const { data: inv } = await db.from('invoices').select('*').eq('id', invoiceId).eq('organization_id', orgId).single()
    if (!inv) return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 })
    if (inv.state !== 'issued') return NextResponse.json({ error: 'not_issued' }, { status: 422 })
    if (!inv.huella || !inv.issuer_cif || !inv.full_number || !inv.issue_date)
      return NextResponse.json({ error: 'invoice_incomplete' }, { status: 422 })
    const { data: lines } = await db.from('invoice_lines').select('tax_rate, line_subtotal, line_tax').eq('invoice_id', invoiceId)

    // ── Load + decrypt certificate ──────────────────────────
    const { data: cert } = await db.from('org_certificates').select('*').eq('organization_id', orgId).maybeSingle()
    if (!cert) return NextResponse.json({ error: 'no_certificate' }, { status: 422 })
    let certPem: string, keyPem: string
    try {
      const p12 = open({ cipher: cert.cert_cipher, iv: cert.cert_iv, tag: cert.cert_tag })
      const password = open({ cipher: cert.pass_cipher, iv: cert.pass_iv, tag: cert.pass_tag }).toString('utf8')
      ;({ certPem, keyPem } = p12ToPem(p12, password))
    } catch (e) {
      return NextResponse.json({ error: 'cert_unreadable', detail: String(e) }, { status: 500 })
    }

    // ── Previous record (for chaining) ──────────────────────
    let prev: AeatPrev | null = null
    if (inv.huella_anterior) {
      const { data: p } = await db.from('invoices')
        .select('issuer_cif, full_number, issue_date, huella')
        .eq('organization_id', orgId).eq('huella', inv.huella_anterior).maybeSingle()
      if (p?.full_number && p.issue_date && p.huella)
        prev = { issuer_cif: p.issuer_cif ?? inv.issuer_cif, full_number: p.full_number, issue_date: p.issue_date, huella: p.huella }
    }

    const aeatInv: AeatInvoice = {
      full_number: inv.full_number, issue_date: inv.issue_date, kind: inv.kind as InvoiceKind,
      issuer_name: inv.issuer_name ?? '', issuer_cif: inv.issuer_cif,
      client_name: inv.client_name, client_cif: inv.client_cif,
      tax_amount: Number(inv.tax_amount), total: Number(inv.total),
      huella: inv.huella, huella_anterior: inv.huella_anterior,
      issued_at: inv.issued_at ?? new Date().toISOString(), notes: inv.notes,
    }
    const xml = buildEnvelope(aeatInv, (lines as AeatLine[]) ?? [], prev)

    // ── Submit ──────────────────────────────────────────────
    let result
    try {
      result = await submitToAeat(xml, certPem, keyPem)
    } catch (e) {
      await db.from('invoices').update({ verifactu_status: 'error', aeat_response: { error: String(e) }, submitted_at: new Date().toISOString() }).eq('id', invoiceId)
      return NextResponse.json({ error: 'aeat_unreachable', detail: String(e) }, { status: 502 })
    }

    await db.from('invoices').update({
      verifactu_status: result.ok ? 'sent' : 'error',
      aeat_csv: result.csv,
      aeat_response: { estadoEnvio: result.estadoEnvio, estadoRegistro: result.estadoRegistro, errorCode: result.errorCode, errorDesc: result.errorDesc },
      submitted_at: new Date().toISOString(),
    }).eq('id', invoiceId)

    return NextResponse.json({
      success: result.ok, status: result.ok ? 'sent' : 'error',
      csv: result.csv, estadoRegistro: result.estadoRegistro,
      errorCode: result.errorCode, errorDesc: result.errorDesc,
    })
  } catch (err) {
    console.error('[verifactu/submit] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
