import { NextResponse } from 'next/server'
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getApiClient } from '@/lib/supabase/api-auth'
import { getStripe } from '@/lib/stripe'
import { sendWithRetry } from '@/lib/resend-send'
import {
  ACCOUNT_DELETION_CONFIRM_WORD,
  ORG_DATA_RETENTION_DAYS,
} from '@/lib/account-deletion'

/**
 * Elimina la cuenta de quien llama (web con cookie o móvil con Bearer).
 *
 * Lo exige Google Play a toda app que permite crear cuenta: borrarla desde la
 * propia app y desde una web (/eliminar-cuenta). Qué se borra y qué no:
 *
 * - La cuenta (auth.users) y el perfil, al momento. Las membresías y los
 *   accesos por cliente/carpeta caen en cascada; lo que creó en organizaciones
 *   ajenas (facturas, documentos, carpetas) se queda sin autor (ON DELETE SET
 *   NULL) pero no se borra: es de la organización, no suyo.
 * - Una organización de la que es el único miembro deja de tener a nadie que
 *   la use: se cancela su suscripción y se marca para borrar a los
 *   ORG_DATA_RETENTION_DAYS días, como al cancelar. No existe todavía un
 *   proceso que la borre sola al llegar la fecha, así que se avisa por correo
 *   a Archivum para hacerlo a mano. Las facturas emitidas no se pueden borrar
 *   (protect_issued_invoice) y la ley obliga a conservarlas.
 * - Si es el único propietario de una organización con más miembros, se
 *   rechaza: borrarla les quitaría el acceso a ellos, y dejarla sin
 *   propietario no la puede gestionar nadie. Primero tiene que nombrar a otro.
 */

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const FROM_EMAIL = process.env.RESEND_FROM ?? 'onboarding@resend.dev'
const NOTIFY_EMAIL = 'facturas@archivum.es'

type Membership = { organization_id: string; role: string }

export async function POST(req: Request) {
  try {
    const supabase = await getApiClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { confirm?: string }
    if (body.confirm?.trim().toUpperCase() !== ACCOUNT_DELETION_CONFIRM_WORD) {
      return NextResponse.json({ error: 'confirmation_required' }, { status: 400 })
    }

    const admin = getAdmin()

    const { data: memberships, error: mErr } = await admin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
    if (mErr) throw mErr

    const ownedIds = (memberships as Membership[] ?? [])
      .filter(m => m.role === 'owner')
      .map(m => m.organization_id)

    // Who else is in the organizations this user owns.
    const { data: others, error: oErr } = ownedIds.length
      ? await admin
          .from('organization_members')
          .select('organization_id, role')
          .in('organization_id', ownedIds)
          .neq('user_id', user.id)
      : { data: [] as Membership[], error: null }
    if (oErr) throw oErr

    const othersByOrg = new Map<string, Membership[]>()
    for (const o of (others as Membership[] ?? [])) {
      othersByOrg.set(o.organization_id, [...(othersByOrg.get(o.organization_id) ?? []), o])
    }

    const blockedIds = ownedIds.filter(id => {
      const rest = othersByOrg.get(id) ?? []
      return rest.length > 0 && !rest.some(r => r.role === 'owner')
    })
    const soloIds = ownedIds.filter(id => (othersByOrg.get(id) ?? []).length === 0)

    const orgNames = await loadOrgNames(admin, [...blockedIds, ...soloIds])

    if (blockedIds.length) {
      return NextResponse.json({
        error: 'owner_with_members',
        organizations: blockedIds.map(id => orgNames.get(id) ?? id),
      }, { status: 409 })
    }

    // Stop billing before anything is deleted: a failure here must leave the
    // account intact rather than a deleted user still being charged.
    const { data: soloOrgs, error: sErr } = soloIds.length
      ? await admin.from('organizations').select('id, stripe_subscription_id').in('id', soloIds)
      : { data: [] as { id: string; stripe_subscription_id: string | null }[], error: null }
    if (sErr) throw sErr

    for (const org of soloOrgs ?? []) {
      if (!org.stripe_subscription_id) continue
      try {
        await getStripe().subscriptions.cancel(org.stripe_subscription_id)
      } catch (err) {
        // Already cancelled on Stripe's side is fine; anything else stops here.
        const code = (err as { code?: string })?.code
        if (code !== 'resource_missing') {
          console.error('[account/delete] stripe cancel', err)
          return NextResponse.json({ error: 'stripe_cancel_failed' }, { status: 502 })
        }
      }
    }

    const now = new Date()
    const deletionAt = new Date(now.getTime() + ORG_DATA_RETENTION_DAYS * 86_400_000)
    if (soloIds.length) {
      const { error } = await admin.from('organizations').update({
        is_active: false,
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        deletion_scheduled_at: deletionAt.toISOString(),
      }).in('id', soloIds)
      if (error) throw error
    }

    // These two references were created without ON DELETE, so they would
    // block deleting the user (e.g. an owner who once invited a colleague).
    for (const [table, column] of [
      ['organization_members', 'invited_by'],
      ['company_user_access', 'granted_by'],
    ] as const) {
      const { error } = await admin.from(table).update({ [column]: null }).eq(column, user.id)
      if (error) throw error
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) {
      console.error('[account/delete] deleteUser', delErr)
      return NextResponse.json({ error: 'delete_failed', detail: delErr.message }, { status: 500 })
    }

    await notify(user.email ?? null, user.id, soloIds.map(id => orgNames.get(id) ?? id), soloIds, deletionAt)

    return NextResponse.json({
      ok: true,
      scheduledOrganizations: soloIds.map(id => orgNames.get(id) ?? id),
      deletionScheduledAt: soloIds.length ? deletionAt.toISOString() : null,
    })
  } catch (err) {
    console.error('[account/delete]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

async function loadOrgNames(admin: SupabaseClient, ids: string[]) {
  const names = new Map<string, string>()
  if (!ids.length) return names
  const { data } = await admin.from('organizations').select('id, name').in('id', ids)
  for (const o of data ?? []) names.set(o.id, o.name)
  return names
}

/** Best effort: the account is already gone, a failed email must not undo that. */
async function notify(email: string | null, userId: string, orgNames: string[], orgIds: string[], deletionAt: Date) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  const resend = new Resend(key)
  const date = deletionAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  try {
    await sendWithRetry(resend, {
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: `Cuenta eliminada${orgIds.length ? ' · organizaciones pendientes de borrar' : ''}`,
      text: [
        `Se ha eliminado la cuenta ${email ?? '(sin correo)'} (${userId}).`,
        '',
        orgIds.length
          ? [
              `Era el único miembro de estas organizaciones. Su suscripción se ha cancelado y quedan marcadas para borrar el ${date}:`,
              ...orgIds.map((id, i) => `- ${orgNames[i]} (${id})`),
              '',
              'No hay un proceso automático que las borre: hay que hacerlo a mano con apps/web/scripts/reset-org-data/.',
              'Las facturas emitidas no se borran: la normativa obliga a conservarlas.',
            ].join('\n')
          : 'No era el único miembro de ninguna organización; no hay nada más que borrar.',
      ].join('\n'),
    })
  } catch (err) {
    console.error('[account/delete] internal notice', err)
  }

  if (!email) return
  try {
    await sendWithRetry(resend, {
      from: FROM_EMAIL,
      to: email,
      subject: 'Tu cuenta de Archivum se ha eliminado',
      text: [
        'Hola:',
        '',
        'Te confirmamos que tu cuenta de Archivum se ha eliminado. Ya no podrás iniciar sesión con este correo.',
        orgIds.length
          ? `Los datos de tu organización se borrarán el ${date}, salvo las facturas emitidas, que la normativa tributaria obliga a conservar. Su suscripción se ha cancelado y no se te cobrará nada más.`
          : '',
        '',
        `Si no has sido tú, escríbenos cuanto antes a ${NOTIFY_EMAIL}.`,
        '',
        'El equipo de Archivum',
      ].filter(Boolean).join('\n'),
    })
  } catch (err) {
    console.error('[account/delete] user notice', err)
  }
}
