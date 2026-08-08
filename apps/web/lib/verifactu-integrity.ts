import type { SupabaseClient } from '@supabase/supabase-js'
import { huellaAltaFromParts, huellaAnulacionFromParts } from '@/lib/verifactu'
import { recordEvent, computeEventHuella, EVENT_TYPES } from '@/lib/verifactu-events'

/**
 * Detección de anomalías (art. 9.1.c-f Orden HAC/1177/2024).
 *
 * The Orden requires the system to detect and record anomalies in the
 * integrity, inalterability and traceability of both the billing records and
 * the event records — and to record the launch of each check as well as its
 * findings, so the absence of a finding is itself evidence that someone looked.
 *
 * Two things are checked, and they catch different failures:
 *
 * **Traceability** — each record's declared predecessor is the huella of the
 * record before it. Catches a broken or forked chain.
 *
 * **Integrity** — each record's stored huella is what its own contents hash
 * to. Catches a record edited in place: the chain would still line up, but the
 * huella would no longer match what it covers.
 *
 * Checking only the chain would miss the second, which is precisely the
 * tampering the huella exists to expose.
 */

export interface Anomaly {
  kind: 'traceability' | 'integrity'
  record: string
  detail: string
}

export interface IntegrityReport {
  orgId: string
  billingRecords: number
  eventRecords: number
  anomalies: Anomaly[]
  eventAnomalies: Anomaly[]
}

/** Verify an organization's billing chain: order, links and stored huellas. */
async function verifyBillingChain(db: any, orgId: string): Promise<{ count: number; anomalies: Anomaly[] }> {
  const anomalies: Anomaly[] = []

  const { data: links } = await db
    .from('verifactu_chain_links')
    .select('kind, invoice_id, annulment_id, full_number, huella, huella_anterior, generated_at')
    .eq('organization_id', orgId)
    .order('generated_at', { ascending: true })

  const chain = links ?? []

  // Traceability: every link but the first names its predecessor's huella.
  for (let i = 0; i < chain.length; i++) {
    const expected = i === 0 ? '' : chain[i - 1].huella
    const declared = chain[i].huella_anterior ?? ''
    if (declared !== expected) {
      anomalies.push({
        kind: 'traceability',
        record: chain[i].full_number ?? chain[i].huella.slice(0, 16),
        detail: i === 0
          ? 'El primer registro de la cadena declara un predecesor'
          : `Declara como anterior una huella que no es la de ${chain[i - 1].full_number ?? 'el registro previo'}`,
      })
    }
  }

  // Integrity: re-hash each record from what is stored and compare.
  const { data: invoices } = await db
    .from('invoices')
    .select('full_number, huella, registro_alta')
    .eq('organization_id', orgId).not('registro_alta', 'is', null)

  for (const inv of invoices ?? []) {
    const r = inv.registro_alta ?? {}
    const recomputed = huellaAltaFromParts({
      issuerNif: r.IDFactura?.IDEmisorFactura ?? '',
      fullNumber: r.IDFactura?.NumSerieFactura ?? '',
      fechaExpedicion: r.IDFactura?.FechaExpedicionFactura ?? '',
      tipoFactura: r.TipoFactura ?? '',
      cuotaTotal: r.CuotaTotal ?? '',
      importeTotal: r.ImporteTotal ?? '',
      previousHuella: r.Encadenamiento?.RegistroAnterior?.Huella ?? '',
      generatedAt: r.FechaHoraHusoGenRegistro ?? '',
    })
    if (recomputed !== inv.huella) {
      anomalies.push({
        kind: 'integrity',
        record: inv.full_number ?? '(sin número)',
        detail: 'La huella almacenada no coincide con el contenido del registro',
      })
    }
  }

  const { data: annulments } = await db
    .from('verifactu_annulments')
    .select('annulled_full_number, huella, registro_anulacion')
    .eq('organization_id', orgId)

  for (const a of annulments ?? []) {
    const r = a.registro_anulacion ?? {}
    const recomputed = huellaAnulacionFromParts({
      issuerNif: r.IDFactura?.IDEmisorFacturaAnulada ?? '',
      annulledFullNumber: r.IDFactura?.NumSerieFacturaAnulada ?? '',
      fechaExpedicion: r.IDFactura?.FechaExpedicionFacturaAnulada ?? '',
      previousHuella: r.Encadenamiento?.RegistroAnterior?.Huella ?? '',
      generatedAt: r.FechaHoraHusoGenRegistro ?? '',
    })
    if (recomputed !== a.huella) {
      anomalies.push({
        kind: 'integrity',
        record: `anulación de ${a.annulled_full_number}`,
        detail: 'La huella almacenada no coincide con el contenido del registro',
      })
    }
  }

  return { count: chain.length, anomalies }
}

/** Verify the event chain the same way. */
async function verifyEventChain(db: any, orgId: string): Promise<{ count: number; anomalies: Anomaly[] }> {
  const anomalies: Anomaly[] = []

  const { data: events } = await db
    .from('verifactu_events')
    .select('event_type, occurred_at, huella, huella_anterior, registro_evento')
    .eq('organization_id', orgId)
    .order('occurred_at', { ascending: true })

  const list = events ?? []

  for (let i = 0; i < list.length; i++) {
    const expected = i === 0 ? '' : list[i - 1].huella
    if ((list[i].huella_anterior ?? '') !== expected) {
      anomalies.push({
        kind: 'traceability',
        record: `${list[i].event_type} · ${list[i].occurred_at}`,
        detail: 'El evento no encadena con el anterior',
      })
    }

    const r = list[i].registro_evento ?? {}
    const sis = r.SistemaInformatico ?? {}
    const recomputed = computeEventHuella({
      producerNif: sis.NIF ?? '',
      systemId: sis.IdSistemaInformatico ?? '',
      systemVersion: sis.Version ?? '',
      installationId: sis.NumeroInstalacion ?? '',
      obligadoNif: r.NIFObligado ?? '',
      eventType: r.TipoEvento ?? '',
      occurredAt: r.FechaHoraHusoEvento ?? '',
      previousHuella: r.EventoAnterior?.Huella ?? '',
    })
    if (recomputed !== list[i].huella) {
      anomalies.push({
        kind: 'integrity',
        record: `${list[i].event_type} · ${list[i].occurred_at}`,
        detail: 'La huella almacenada no coincide con el contenido del evento',
      })
    }
  }

  return { count: list.length, anomalies }
}

/**
 * Run both checks and record what the Orden requires.
 *
 * The launch events go on the record before the work starts: a check that
 * crashed halfway would otherwise leave no trace that it was ever attempted.
 */
export async function runIntegrityCheck(
  supabase: SupabaseClient,
  orgId: string,
): Promise<IntegrityReport> {
  const db = supabase as any

  await recordEvent(db, { orgId, type: EVENT_TYPES.DETECCION_LANZADA_FACTURACION })
  const billing = await verifyBillingChain(db, orgId)
  if (billing.anomalies.length) {
    await recordEvent(db, {
      orgId, type: EVENT_TYPES.ANOMALIA_FACTURACION,
      detail: { total: billing.anomalies.length, anomalias: billing.anomalies.slice(0, 50) },
    })
  }

  await recordEvent(db, { orgId, type: EVENT_TYPES.DETECCION_LANZADA_EVENTOS })
  const events = await verifyEventChain(db, orgId)
  if (events.anomalies.length) {
    await recordEvent(db, {
      orgId, type: EVENT_TYPES.ANOMALIA_EVENTOS,
      detail: { total: events.anomalies.length, anomalias: events.anomalies.slice(0, 50) },
    })
  }

  return {
    orgId,
    billingRecords: billing.count,
    eventRecords: events.count,
    anomalies: billing.anomalies,
    eventAnomalies: events.anomalies,
  }
}

/**
 * Registro resumen de eventos (art. 9.2).
 *
 * One per six hours the system has been operating, summarising what happened
 * since the previous summary — and generated even when nothing did, because
 * "nothing happened" is itself the thing being attested.
 */
export async function recordEventSummary(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const db = supabase as any

  const { data: lastSummary } = await db
    .from('verifactu_events')
    .select('occurred_at')
    .eq('organization_id', orgId).eq('event_type', EVENT_TYPES.RESUMEN)
    .order('occurred_at', { ascending: false }).limit(1).maybeSingle()

  const since = lastSummary?.occurred_at ?? null

  let q = db.from('verifactu_events')
    .select('event_type')
    .eq('organization_id', orgId)
  if (since) q = q.gt('occurred_at', since)
  const { data: since_events } = await q

  const counts: Record<string, number> = {}
  for (const e of since_events ?? []) {
    counts[e.event_type] = (counts[e.event_type] ?? 0) + 1
  }

  return recordEvent(db, {
    orgId,
    type: EVENT_TYPES.RESUMEN,
    detail: {
      desde: since ?? 'inicio',
      totalEventos: since_events?.length ?? 0,
      porTipo: counts,
      // Said explicitly rather than inferred from an empty object: the article
      // requires the summary to reflect the circumstance of nothing happening.
      sinEventos: (since_events?.length ?? 0) === 0,
    },
  })
}
