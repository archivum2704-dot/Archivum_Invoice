import { NextRequest, NextResponse } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-auth'
import { adminClient } from '@/lib/verifactu-submit'
import { recordEvent, EVENT_TYPES } from '@/lib/verifactu-events'
import { registroAltaXml, registroAnulacionXml } from '@/lib/verifactu-xml'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * GET /api/verifactu/export?orgId=…
 *
 * Download, dump and archive the organization's billing records (art. 8.2.c).
 *
 * The file carries the records as stored — the JSON the huella was computed
 * over — plus each one serialised to XML, so the export is readable both by a
 * person and by whatever the AEAT or an inspector wants to run against it.
 * Deriving the XML here rather than storing it keeps one source of truth.
 *
 * The export itself is a logged event: knowing that records left the system,
 * when and at whose hand, is part of what the log is for.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId') ?? ''
    if (!orgId) return NextResponse.json({ error: 'missing_org' }, { status: 400 })

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

    const [{ data: invoices }, { data: annulments }, { data: links }, { data: events }] = await Promise.all([
      db.from('invoices')
        .select('full_number, issue_date, total, huella, huella_anterior, registro_alta, verifactu_status, aeat_csv, submitted_at')
        .eq('organization_id', orgId).not('registro_alta', 'is', null)
        .order('issued_at', { ascending: true }),
      db.from('verifactu_annulments')
        .select('annulled_full_number, annulled_issue_date, huella, huella_anterior, registro_anulacion, verifactu_status, aeat_csv, submitted_at, reason')
        .eq('organization_id', orgId).order('generated_at', { ascending: true }),
      db.from('verifactu_chain_links')
        .select('kind, full_number, huella, huella_anterior, generated_at')
        .eq('organization_id', orgId).order('generated_at', { ascending: true }),
      db.from('verifactu_events')
        .select('event_type, actor_email, detail, occurred_at, huella, huella_anterior')
        .eq('organization_id', orgId).order('occurred_at', { ascending: true }),
    ])

    // Verify the chain as exported rather than asserting it is intact: an
    // export that quietly carried a broken chain would be worse than none.
    const chain = links ?? []
    const breaks: string[] = []
    for (let i = 1; i < chain.length; i++) {
      if ((chain[i].huella_anterior ?? '') !== chain[i - 1].huella) {
        breaks.push(`${chain[i - 1].full_number ?? '?'} → ${chain[i].full_number ?? '?'}`)
      }
    }

    const exportedAt = new Date().toISOString()
    const payload = {
      formato: 'archivum-verifactu-export',
      version: 1,
      exportadoEl: exportedAt,
      exportadoPor: profile?.email ?? user.email ?? null,
      obligado: { nombreRazon: org.name, nif: org.cif },
      resumen: {
        registrosDeAlta: invoices?.length ?? 0,
        registrosDeAnulacion: annulments?.length ?? 0,
        eslabonesDeCadena: chain.length,
        eventos: events?.length ?? 0,
        cadenaIntegra: breaks.length === 0,
        rupturasDeCadena: breaks,
      },
      registrosDeAlta: (invoices ?? []).map((i: any) => ({
        numero: i.full_number,
        fecha: i.issue_date,
        total: i.total,
        huella: i.huella,
        huellaAnterior: i.huella_anterior,
        estadoAeat: i.verifactu_status,
        csvAeat: i.aeat_csv,
        remitidoEl: i.submitted_at,
        registro: i.registro_alta,
        xml: registroAltaXml(i.registro_alta),
      })),
      registrosDeAnulacion: (annulments ?? []).map((a: any) => ({
        facturaAnulada: a.annulled_full_number,
        fechaFacturaAnulada: a.annulled_issue_date,
        motivo: a.reason,
        huella: a.huella,
        huellaAnterior: a.huella_anterior,
        estadoAeat: a.verifactu_status,
        csvAeat: a.aeat_csv,
        remitidoEl: a.submitted_at,
        registro: a.registro_anulacion,
        xml: registroAnulacionXml(a.registro_anulacion),
      })),
      cadena: chain,
      registroDeEventos: events ?? [],
    }

    await recordEvent(db, {
      orgId, type: EVENT_TYPES.EXPORTACION_FACTURACION,
      actor: { userId: user.id, email: profile?.email ?? user.email },
      detail: {
        registrosDeAlta: payload.resumen.registrosDeAlta,
        registrosDeAnulacion: payload.resumen.registrosDeAnulacion,
        cadenaIntegra: payload.resumen.cadenaIntegra,
      },
    })

    // An intact chain is asserted only when it was checked and held.
    if (breaks.length > 0) {
      await recordEvent(db, {
        orgId, type: EVENT_TYPES.ANOMALIA_FACTURACION,
        actor: { userId: user.id, email: profile?.email ?? user.email },
        detail: { deteccion: 'ruptura de cadena en exportación', rupturas: breaks },
      })
    }

    const filename = `verifactu-${(org.cif ?? orgId).replace(/[^\w-]/g, '')}-${exportedAt.slice(0, 10)}.json`
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[verifactu/export] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
