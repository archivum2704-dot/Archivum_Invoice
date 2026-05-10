import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

    // Verify the requesting user is an admin of the org
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: callerMember } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!callerMember || !['owner', 'admin'].includes(callerMember.role)) {
      return NextResponse.json({ error: 'not_authorized' }, { status: 403 })
    }

    // Enforce dynamic user limit based on subscription
    const { data: orgBilling } = await supabase
      .from('organizations')
      .select('subscription_status, stripe_subscription_id, extra_users_quantity')
      .eq('id', orgId)
      .single()

    const status = orgBilling?.subscription_status ?? null
    const hasPaidSub = !!orgBilling?.stripe_subscription_id
    const isPaidActive = hasPaidSub && (status === 'active' || status === 'trialing')

    // Free plan: 1 user max. Paid plan: 5 + extras.
    const maxUsers = isPaidActive ? 5 + (orgBilling?.extra_users_quantity ?? 0) : 1

    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    if (memberCount !== null && memberCount >= maxUsers) {
      return NextResponse.json({
        error: 'member_limit_reached',
        isFreePlan: !isPaidActive,
        maxUsers,
      }, { status: 403 })
    }

    const admin = getAdminClient()
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
        invited_by: user.id,
      })

      return NextResponse.json({ success: true, existing: true })
    }

    // New user — create account + generate invite link (no email sent by Supabase)
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      user_metadata: { first_name: firstName ?? '', last_name: lastName ?? '' },
      email_confirm: false,
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

    // Generate the activation/set-password link
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: normalizedEmail,
      options: { redirectTo: `${APP_URL}/auth/callback` },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      console.error('[create-member] generateLink error:', linkErr)
      // User was created — still add them to org, they can reset password later
    }

    const activationLink = linkData?.properties?.action_link ?? `${APP_URL}/auth/login`

    // Send invite email via Resend
    const resend = getResend()
    const { error: emailErr } = await resend.emails.send({
      from: FROM_EMAIL,
      to: normalizedEmail,
      subject: 'Te han invitado a Archivum',
      html: buildInviteEmail({ displayName, activationLink, role, appUrl: APP_URL }),
    })

    if (emailErr) {
      console.error('[create-member] Resend error:', emailErr)
      // Non-fatal — user is created, just couldn't send email
    }

    // Add to organization
    const { error: memberErr } = await admin.from('organization_members').insert({
      organization_id: orgId,
      user_id: newUser.user.id,
      role,
      invited_by: user.id,
    })

    if (memberErr) {
      console.error('[create-member] insert member error:', memberErr)
      return NextResponse.json({ error: 'server_error', detail: memberErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, existing: false })

  } catch (err) {
    console.error('[create-member] unhandled error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}

// ── Email template ────────────────────────────────────────────────────────────
function buildInviteEmail({ displayName, activationLink, role, appUrl }: {
  displayName: string
  activationLink: string
  role: string
  appUrl: string
}) {
  const roleLabel: Record<string, string> = {
    admin: 'Administrador', member: 'Miembro', viewer: 'Visor',
  }
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
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">Te han invitado</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
            Hola <strong style="color:#111827;">${displayName}</strong>, has sido añadido a Archivum
            con el rol de <strong style="color:#2563EB;">${roleLabel[role] ?? role}</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.6;">
            Activa tu cuenta y establece tu contraseña haciendo clic en el botón:
          </p>
          <a href="${activationLink}"
             style="display:inline-block;background:#2563EB;color:#FFFFFF;font-size:15px;font-weight:600;
                    padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:-0.2px;">
            Activar mi cuenta →
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;">
            Este enlace expira en 24 horas. Si no esperabas esta invitación, puedes ignorar este correo.
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
