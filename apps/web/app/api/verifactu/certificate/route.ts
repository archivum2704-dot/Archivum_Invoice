import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import forge from 'node-forge'
import { seal } from '@/lib/crypto-vault'

export const runtime = 'nodejs'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service env')
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** Resolve the caller and confirm they may manage the org's certificate. */
async function authorize(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' as const, status: 401 }
  const db = admin()
  const { data: profile } = await db.from('profiles').select('platform_role').eq('id', user.id).single()
  if (profile?.platform_role === 'super_admin') return { user, db }
  const { data: member } = await db.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single()
  if (!member || !['owner', 'admin'].includes(member.role)) return { error: 'forbidden' as const, status: 403 }
  return { user, db }
}

// ── Upload / replace certificate ────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { orgId, certBase64, password } = await req.json()
    if (!orgId || !certBase64 || password == null)
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    const auth = await authorize(orgId)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // Parse + validate the .p12 with the given password
    let subject = '', nif: string | null = null, validUntil: string | null = null
    try {
      const der = forge.util.decode64(certBase64)
      const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), password)
      const bag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]
      const cert = bag?.cert
      if (!cert) throw new Error('no_cert')
      subject = cert.subject.attributes.map((a: any) => `${a.shortName || a.type}=${a.value}`).join(', ')
      const sn = cert.subject.getField('2.5.4.5')?.value as string | undefined
      const cn = cert.subject.getField('CN')?.value as string | undefined
      nif = (sn ?? cn ?? '').replace(/^IDC[A-Z]{2}-/i, '').trim() || null
      validUntil = cert.validity.notAfter.toISOString()
    } catch {
      return NextResponse.json({ error: 'invalid_certificate' }, { status: 422 })
    }

    // Encrypt the raw .p12 bytes + password
    let certSealed, passSealed
    try {
      certSealed = seal(Buffer.from(certBase64, 'base64'))
      passSealed = seal(String(password))
    } catch (e) {
      return NextResponse.json({ error: 'vault_not_configured', detail: String(e) }, { status: 500 })
    }

    const { error } = await auth.db.from('org_certificates').upsert({
      organization_id: orgId,
      cert_cipher: certSealed.cipher, cert_iv: certSealed.iv, cert_tag: certSealed.tag,
      pass_cipher: passSealed.cipher, pass_iv: passSealed.iv, pass_tag: passSealed.tag,
      subject, nif, valid_until: validUntil,
      uploaded_by: auth.user.id, uploaded_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' })
    if (error) return NextResponse.json({ error: 'store_failed', detail: error.message }, { status: 500 })

    return NextResponse.json({ success: true, subject, nif, validUntil })
  } catch (err) {
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}

// ── Certificate status (metadata only, never the secret) ────
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') ?? ''
  if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })
  const auth = await authorize(orgId)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { data } = await auth.db.from('org_certificates')
    .select('subject, nif, valid_until, uploaded_at').eq('organization_id', orgId).maybeSingle()
  return NextResponse.json({ exists: !!data, ...data })
}

// ── Remove certificate ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId') ?? ''
  if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })
  const auth = await authorize(orgId)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  await auth.db.from('org_certificates').delete().eq('organization_id', orgId)
  return NextResponse.json({ success: true })
}
