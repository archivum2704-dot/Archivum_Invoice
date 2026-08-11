import type { SupabaseClient } from '@supabase/supabase-js'
import { huellaAltaFromParts, huellaAnulacionFromParts } from '@/lib/verifactu'
import {
  recordEvent, computeEventHuella, computeEventHuellaLegacy, EVENT_TYPES,
} from '@/lib/verifactu-events'

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


/**
 * Walk a chain by its own links instead of sorting it by time.
 *
 * The AEAT's timestamp format has one-second resolution (art. 13 fixes it, so
 * it cannot be widened), and a daily sweep writes four events inside the same
 * second. Ordering by that timestamp puts them in arbitrary order, and a
 * verifier walking that order sees a chain that does not join up — which is
 * how this reported anomalies on records that were perfectly intact, and then
 * wrote that false accusation into an immutable log.
 *
 * Following the links has no such ambiguity, and it detects more: a fork
 * (two records claiming one predecessor), a missing predecessor, and records
 * left unreachable — none of which sorting by time can tell apart.
 */
export function walkChain<T extends { huella: string; huella_anterior: string | null }>(
  records: T[],
  describe: (r: T) => string,
): Anomaly[] {
  const anomalies: Anomaly[] = []
  if (records.length === 0) return anomalies

  const byHuella = new Map<string, T>()
  for (const r of records) byHuella.set(r.huella, r)

  const roots = records.filter(r => !r.huella_anterior)
  if (roots.length === 0) {
    anomalies.push({
      kind: 'traceability',
      record: describe(records[0]),
      detail: 'Ningún registro abre la cadena: todos declaran un predecesor',
    })
    return anomalies
  }
  if (roots.length > 1) {
    for (const r of roots.slice(1)) {
      anomalies.push({
        kind: 'traceability',
        record: describe(r),
        detail: 'Un segundo registro declara ser el primero de la cadena',
      })
    }
  }

  // Successors, to spot two records claiming the same predecessor.
  const successors = new Map<string, T[]>()
  for (const r of records) {
    if (!r.huella_anterior) continue
    const list = successors.get(r.huella_anterior) ?? []
    list.push(r)
    successors.set(r.huella_anterior, list)
    if (!byHuella.has(r.huella_anterior)) {
      anomalies.push({
        kind: 'traceability',
        record: describe(r),
        detail: 'Declara como anterior una huella que no existe en la cadena',
      })
    }
  }
  for (const [anterior, list] of successors) {
    if (list.length > 1) {
      anomalies.push({
        kind: 'traceability',
        record: list.map(describe).join(' · '),
        detail: `La cadena se bifurca: ${list.length} registros declaran el mismo predecesor`,
      })
    }
  }

  // Everything must be reachable from the first record.
  const visto = new Set<string>()
  let actual: T | undefined = roots[0]
  while (actual && !visto.has(actual.huella)) {
    visto.add(actual.huella)
    actual = (successors.get(actual.huella) ?? [])[0]
  }
  for (const r of records) {
    if (!visto.has(r.huella)) {
      anomalies.push({
        kind: 'traceability',
        record: describe(r),
        detail: 'El registro queda fuera de la cadena: no se llega a él desde el primero',
      })
    }
  }

  return anomalies
}

/** Verify an organization's billing chain: links and stored huellas. */
async function verifyBillingChain(db: any, orgId: string): Promise<{ count: number; anomalies: Anomaly[] }> {
  const anomalies: Anomaly[] = []

  const { data: links } = await db
    .from('verifactu_chain_links')
    .select('kind, invoice_id, annulment_id, full_number, huella, huella_anterior, generated_at')
    .eq('organization_id', orgId)
    .order('generated_at', { ascending: true })

  const chain = links ?? []

  anomalies.push(...walkChain(chain, (r: any) => r.full_number ?? r.huella.slice(0, 16)))

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

  anomalies.push(...walkChain(list, (r: any) => `${r.event_type} · ${r.occurred_at}`))

  for (let i = 0; i < list.length; i++) {
    // Two shapes live in this table. Events written before the AEAT's huella
    // document arrived carry the old field names at the top level; the ones
    // after it are nested under `Evento` and follow EventosSIF.xsd. Each is
    // verified with the formula it was written with — re-hashing an old event
    // with the new formula would report tampering that never happened, and
    // dropping the check would lose tamper detection on the ones we have.
    const r = list[i].registro_evento ?? {}
    const ev = r.Evento
    let recomputed: string
    if (ev) {
      const sis = ev.SistemaInformatico ?? {}
      recomputed = computeEventHuella({
        producerNif: sis.NIF ?? '',
        producerOtroId: sis.IDOtro?.ID ?? '',
        systemId: sis.IdSistemaInformatico ?? '',
        systemVersion: sis.Version ?? '',
        installationId: sis.NumeroInstalacion ?? '',
        obligadoNif: ev.ObligadoEmision?.NIF ?? '',
        eventType: ev.TipoEvento ?? '',
        occurredAt: ev.FechaHoraHusoGenEvento ?? '',
        previousHuella: ev.Encadenamiento?.EventoAnterior?.HuellaEvento ?? '',
      })
    } else {
      const sis = r.SistemaInformatico ?? {}
      recomputed = computeEventHuellaLegacy({
        producerNif: sis.NIF ?? '',
        systemId: sis.IdSistemaInformatico ?? '',
        systemVersion: sis.Version ?? '',
        installationId: sis.NumeroInstalacion ?? '',
        obligadoNif: r.NIFObligado ?? '',
        eventType: r.TipoEvento ?? '',
        occurredAt: r.FechaHoraHusoEvento ?? '',
        previousHuella: r.EventoAnterior?.Huella ?? '',
      })
    }
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
 * The article asks for one per six hours of operation, summarising what
 * happened since the previous summary — generated even when nothing did,
 * because "nothing happened" is itself the thing being attested.
 *
 * It does not bind Archivum. The AEAT's developer FAQ (4 December 2025) states
 * that a system able to operate only as VERI*FACTU — which is what Archivum
 * declares in section 1.e of its declaración responsable — is not obliged to
 * implement an event register at all, and the summary is part of that
 * register. We keep it because a log of anomalies nobody attests to is weak
 * evidence, but it runs once a day, which is what the hosting plan allows and
 * is entirely sufficient for something voluntary.
 *
 * If Archivum ever gains a NO VERI*FACTU mode, this stops being optional and
 * the six-hour cadence becomes mandatory.
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
