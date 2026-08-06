import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { resolveEntitlements } from '@/lib/pricing'

// Generate a readable but strong temporary password.
// Ambiguous characters (0/O, 1/l/I) are excluded so it can be shared verbally.
function generatePassword(): string {
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lower   = 'abcdefghijkmnpqrstuvwxyz'
  const digits  = '23456789'
  const symbols = '!@#$%*?'
  const all = upper + lower + digits + symbols
  const pick = (set: string) => set[randomInt(set.length)]
  // Guarantee at least one of each class, then fill to 12 chars.
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (chars.length < 12) chars.push(pick(all))
  // Fisher–Yates shuffle so the guaranteed chars aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error(`Missing env vars: url=${!!url} key=${!!key}`)
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return new Resend(key)
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://archivum2704-dot.vercel.app'
const FROM_EMAIL = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, firstName, lastName, role, orgId } = body

    if (!email || !orgId || !role) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Determine auth: Bearer token (mobile) or cookie session (web)
    let userId: string
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data.user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      }
      userId = data.user.id
    } else {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    // Platform admins (super_admin) bypass org-membership and limit checks
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('platform_role')
      .eq('id', userId)
      .single()
    const isSuper = callerProfile?.platform_role === 'super_admin'

    // Verify the requesting user is an admin of the org (unless platform admin)
    const { data: callerMember } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .single()

    if (!isSuper && (!callerMember || !['owner', 'admin'].includes(callerMember.role))) {
      return NextResponse.json({ error: 'not_authorized' }, { status: 403 })
    }

    // Enforce dynamic user limit based on subscription
    const { data: orgBilling } = await admin
      .from('organizations')
      .select('name, access_code, subscription_status, stripe_subscription_id, extra_users_quantity, subscription_plan')
      .eq('id', orgId)
      .single()

    // Same resolver the billing screens read, so the count shown on screen and
    // the limit enforced here can never disagree.
    const { isActive: isPaidActive, maxUsers } = resolveEntitlements(orgBilling)

    const { count: memberCount } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    if (!isSuper && memberCount !== null && memberCount >= maxUsers) {
      return NextResponse.json({
        error: 'member_limit_reached',
        isFreePlan: !isPaidActive,
        maxUsers,
      }, { status: 403 })
    }
    const normalizedEmail = email.toLowerCase().trim()
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || normalizedEmail

    // Check if user already exists
    const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) {
      return NextResponse.json({ error: 'server_error', detail: listErr.message }, { status: 500 })
    }

    const existingUser = existingUsers?.users?.find(u => u.email === normalizedEmail)

    if (existingUser) {
      const { data: alreadyMember } = await admin
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', existingUser.id)
        .single()

      if (alreadyMember) {
        return NextResponse.json({ error: 'already_member' }, { status: 409 })
      }

      await admin.from('organization_members').insert({
        organization_id: orgId,
        user_id: existingUser.id,
        role,
        invited_by: userId,
      })

      return NextResponse.json({ success: true, existing: true })
    }

    // New user — create account with a generated password and confirm the email
    // so they can sign in immediately (no activation click needed).
    const password = generatePassword()
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      user_metadata: { first_name: firstName ?? '', last_name: lastName ?? '' },
      email_confirm: true,
    })

    if (createErr || !newUser?.user) {
      console.error('[create-member] createUser error:', createErr)
      return NextResponse.json({ error: 'server_error', detail: createErr?.message ?? 'create_failed' }, { status: 500 })
    }

    // Ensure profile row exists (the DB trigger may not fire for admin-created users)
    await admin.from('profiles').upsert({
      id: newUser.user.id,
      email: normalizedEmail,
      first_name: firstName ?? '',
      last_name: lastName ?? '',
    }, { onConflict: 'id' })

    // Add to organization
    const { error: memberErr } = await admin.from('organization_members').insert({
      organization_id: orgId,
      user_id: newUser.user.id,
      role,
      invited_by: userId,
    })

    if (memberErr) {
      console.error('[create-member] insert member error:', memberErr)
      return NextResponse.json({ error: 'server_error', detail: memberErr.message }, { status: 500 })
    }

    // Send a welcome email with the credentials (best-effort — never blocks
    // creation). Whether it went out is reported back, because an admin who
    // believes the email arrived will not pass the credentials on by hand, and
    // the new user is then locked out with nobody aware of it.
    let emailSent = false
    let emailError: string | null = null
    try {
      const resend = getResend()
      const { error: emailErr } = await resend.emails.send({
        from: FROM_EMAIL,
        to: normalizedEmail,
        subject: `Tu cuenta de Archivum · ${orgBilling?.name ?? ''}`.trim(),
        html: buildInviteEmail({
          displayName, email: normalizedEmail, password, role, appUrl: APP_URL,
          orgName: orgBilling?.name ?? null, accessCode: orgBilling?.access_code ?? null,
        }),
      })
      if (emailErr) { console.error('[create-member] Resend error:', emailErr); emailError = emailErr.message }
      else emailSent = true
    } catch (mailErr) {
      // Email not configured or failed — the admin still gets the credentials in the response.
      console.error('[create-member] email skipped:', mailErr)
      emailError = String(mailErr)
    }

    return NextResponse.json({
      success: true,
      existing: false,
      email: normalizedEmail,
      displayName,
      password,
      orgName: orgBilling?.name ?? null,
      // The mobile app asks for this alongside the password; without it a
      // non-owner cannot sign in there at all.
      accessCode: orgBilling?.access_code ?? null,
      emailSent,
      emailError,
    })

  } catch (err) {
    console.error('[create-member] unhandled error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}

// ── Email template ────────────────────────────────────────────────────────────
function buildInviteEmail({ displayName, email, password, role, appUrl, orgName, accessCode }: {
  displayName: string
  email: string
  password: string
  role: string
  appUrl: string
  orgName: string | null
  accessCode: string | null
}) {
  const roleLabel: Record<string, string> = {
    admin: 'Administrador', member: 'Miembro', viewer: 'Visor',
  }
  const loginUrl = `${appUrl}/auth/login`
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#FFFFFF;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:#1E3A5F;padding:32px 40px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">Archivum</p>
          <p style="margin:4px 0 0;font-size:13px;color:#93C5FD;">Gestión documental inteligente</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">Tu cuenta está lista</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
            Hola <strong style="color:#111827;">${displayName}</strong>, has sido añadido a
            <strong style="color:#111827;">${orgName ?? 'Archivum'}</strong>
            con el rol de <strong style="color:#2563EB;">${roleLabel[role] ?? role}</strong>.
            Estas son tus credenciales de acceso:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">Correo</p>
              <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#111827;">${email}</p>
              <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">Contraseña temporal</p>
              <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#111827;font-family:monospace;letter-spacing:0.5px;">${password}</p>
              ${accessCode ? `<p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">Código de empresa</p>
              <p style="margin:0;font-size:19px;font-weight:700;color:#111827;font-family:monospace;letter-spacing:2px;">${accessCode}</p>` : ''}
            </td></tr>
          </table>
          ${accessCode ? `<p style="margin:-8px 0 24px;font-size:13px;color:#6B7280;line-height:1.6;">
            En la <strong style="color:#111827;">app móvil</strong>, entra por «Usuario» e introduce el
            código de empresa junto con tu correo y contraseña. En la web basta con el correo y la contraseña.
          </p>` : ''}
          <a href="${loginUrl}"
             style="display:inline-block;background:#2563EB;color:#FFFFFF;font-size:15px;font-weight:600;
                    padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:-0.2px;">
            Iniciar sesión →
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;">
            Por seguridad, te recomendamos cambiar la contraseña después de tu primer inicio de sesión.
            Si no esperabas este correo, puedes ignorarlo.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #F3F4F6;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            © ${new Date().getFullYear()} Archivum · <a href="${appUrl}" style="color:#2563EB;text-decoration:none;">Ir a la app</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
