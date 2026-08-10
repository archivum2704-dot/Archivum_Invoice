import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { adminClient } from '@/lib/verifactu-submit'
import { recordEvent, EVENT_TYPES } from '@/lib/verifactu-events'
import { registroEventoXml } from '@/lib/verifactu-events-xml'

export const runtime = 'nodejs'
// Vercel Hobby caps this at 60 seconds; anything higher fails the build, not
// the request. Raise it here only together with the plan.
export const maxDuration = 60

/**
 * GET /api/verifactu/export/eventos?orgId=…&desde=…&hasta=…
 *
 * Export the event records for a period (art. 9.1.i de la Orden HAC/1177/2024).
 *
 * The Orden treats this as an operation of its own, distinct from exporting
 * the billing records, and gives it its own event type — so it gets its own
 * route rather than riding along inside the billing export, which is where it
 * used to live.
 *
 * `desde` and `hasta` are optional ISO dates. Absent, the whole log is
 * exported; the article speaks of a period, and "everything" is a period.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId') ?? ''
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

    const desde = req.nextUrl.searchParams.get('desde')
    const hasta = req.nextUrl.searchParams.get('hasta')

    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const db: any = adminClient()
    const { data: profile } = await db.from('profiles').select('platform_role, email').eq('id', user.id).single()
    if (profile?.platform_role !== 'super_admin') {
      const { data: member } = await db.from('organization_members')
        .select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
    }

    const { data: org } = await db.from('organizations').select('name, cif').eq('id', orgId).single()
    if (!org) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })

    let q = db.from('verifactu_events')
      .select('event_type, actor_email, detail, occurred_at, huella, huella_anterior, registro_evento')
      .eq('organization_id', orgId)
      .order('occurred_at', { ascending: true })
    if (desde) q = q.gte('occurred_at', desde)
    if (hasta) q = q.lte('occurred_at', hasta)
    const { data: events } = await q

    const list = events ?? []

    // Verify the event chain as exported, the same way the billing export
    // does: an export that quietly carried a broken chain would be worse than
    // no export at all.
    const breaks: string[] = []
    for (let i = 1; i < list.length; i++) {
      if ((list[i].huella_anterior ?? '') !== list[i - 1].huella) {
        breaks.push(`${list[i - 1].event_type} → ${list[i].event_type} (${list[i].occurred_at})`)
      }
    }

    // Records written before the layout was corrected cannot be expressed in
    // the schema. They are exported with their stored content and counted, so
    // the gap is visible rather than silent.
    let sinXml = 0
    const registros = list.map((e: any) => {
      const xml = registroEventoXml(e.registro_evento)
      if (!xml) sinXml++
      return {
        tipo: e.event_type,
        tipoAeat: e.registro_evento?.Evento?.TipoEvento ?? null,
        ocurridoEl: e.occurred_at,
        usuario: e.actor_email,
        huella: e.huella,
        huellaAnterior: e.huella_anterior,
        detalle: e.detail,
        registro: e.registro_evento,
        xml,
      }
    })

    const exportedAt = new Date().toISOString()
    const payload = {
      formato: 'archivum-verifactu-export-eventos',
      version: 1,
      exportadoEl: exportedAt,
      exportadoPor: profile?.email ?? user.email ?? null,
      obligado: { nombreRazon: org.name, nif: org.cif },
      periodo: {
        desde: desde ?? (list[0]?.occurred_at ?? null),
        hasta: hasta ?? (list[list.length - 1]?.occurred_at ?? null),
      },
      resumen: {
        eventos: list.length,
        cadenaIntegra: breaks.length === 0,
        rupturasDeCadena: breaks,
        sinXmlPorFormatoAnterior: sinXml,
      },
      // Said plainly in the file itself, so nobody reading the export has to
      // work out why the XML lacks something the schema asks for.
      nota:
        'Los registros se serializan conforme a EventosSIF.xsd salvo el elemento ds:Signature. ' +
        'Archivum opera exclusivamente como VERI*FACTU, modalidad en la que los registros no ' +
        'llevan firma electrónica expresa.',
      registros,
    }

    await recordEvent(db, {
      orgId, type: EVENT_TYPES.EXPORTACION_EVENTOS,
      actor: { userId: user.id, email: profile?.email ?? user.email },
      detail: {
        eventos: list.length,
        desde: payload.periodo.desde,
        hasta: payload.periodo.hasta,
        cadenaIntegra: breaks.length === 0,
      },
    })

    if (breaks.length > 0) {
      await recordEvent(db, {
        orgId, type: EVENT_TYPES.ANOMALIA_EVENTOS,
        actor: { userId: user.id, email: profile?.email ?? user.email },
        detail: { deteccion: 'ruptura de cadena en exportación de eventos', rupturas: breaks },
      })
    }

    const filename = `verifactu-eventos-${(org.cif ?? orgId).replace(/[^\w-]/g, '')}-${exportedAt.slice(0, 10)}.json`
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[verifactu/export/eventos] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
