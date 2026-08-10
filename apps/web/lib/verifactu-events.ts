import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { nowWithOffset, sistemaInformatico } from '@/lib/verifactu'

/**
 * Registro de eventos (art. 8.3 RD 1007/2023).
 *
 * The system must record automatically, as they happen, the interactions and
 * occurrences during its use, and those records must be consultable from
 * within the system.
 *
 * Two rules shape everything here:
 *
 * Recording an event must never break the operation that caused it. An invoice
 * that failed to issue because its log entry could not be written would be a
 * worse outcome than a missing log line — so failures are reported and
 * swallowed, never propagated.
 *
 * And nothing here ever guesses. An event the system raises on its own carries
 * no actor; attributing it to whoever happened to be nearby would put a
 * person's name against something they did not do.
 */

/**
 * Event types.
 *
 * The first group is what article 9.1 of the Orden HAC/1177/2024 requires the
 * system to detect and record. Two of them — starting and stopping operation
 * as NO VERI*FACTU — do not apply here: Archivum only ever operates in
 * VERI*FACTU mode, so an event announcing the other mode would be false.
 *
 * The second group is ours. The Orden sets a floor, not a ceiling, and a log
 * that recorded anomalies but not the submissions they concern would be poor
 * evidence of anything.
 */
export const EVENT_TYPES = {
  // ── Required by art. 9.1 ──
  /** c) The integrity check over billing records was launched. */
  DETECCION_LANZADA_FACTURACION: 'deteccion_anomalias_facturacion_lanzada',
  /** d) Anomalies found in billing records. */
  ANOMALIA_FACTURACION: 'anomalia_facturacion_detectada',
  /** e) The integrity check over event records was launched. */
  DETECCION_LANZADA_EVENTOS: 'deteccion_anomalias_eventos_lanzada',
  /** f) Anomalies found in event records. */
  ANOMALIA_EVENTOS: 'anomalia_eventos_detectada',
  /** g) A backup was restored from within the system. */
  RESTAURACION_COPIA: 'restauracion_copia_seguridad',
  /** h) Billing records exported for a period. */
  EXPORTACION_FACTURACION: 'exportacion_registros_facturacion',
  /** i) Event records exported for a period. */
  EXPORTACION_EVENTOS: 'exportacion_registros_evento',
  /** art. 9.2: the six-hourly summary, and the one before shutting down. */
  RESUMEN: 'registro_resumen_eventos',

  // ── Ours ──
  ALTA: 'registro_alta_generado',
  ANULACION: 'registro_anulacion_generado',
  ENVIO_INICIADO: 'envio_aeat_iniciado',
  ENVIO_ACEPTADO: 'envio_aeat_aceptado',
  ENVIO_RECHAZADO: 'envio_aeat_rechazado',
  ENVIO_FALLIDO: 'envio_aeat_fallido',
  CERTIFICADO_ALTA: 'certificado_subido',
  CERTIFICADO_BAJA: 'certificado_eliminado',
} as const

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES]

/**
 * `TipoEvento` as the AEAT codes it (EventosSIF.xsd, TipoEventoType).
 *
 * The schema does not take free text: the field is a two-character code. Ours
 * are voluntary events, which the AEAT groups under 90 — "otros tipos de
 * eventos a registrar voluntariamente por la persona o entidad productora".
 * The descriptive name stays on our own row and in `OtrosDatosEvento`, so the
 * log remains readable without putting anything invalid in the record.
 *
 * Codes 01 and 02 (starting and stopping as NO VERI*FACTU) have no mapping:
 * Archivum only operates as VERI*FACTU, so raising them would be false.
 */
export const AEAT_EVENT_CODE: Record<EventType, string> = {
  [EVENT_TYPES.DETECCION_LANZADA_FACTURACION]: '03',
  [EVENT_TYPES.ANOMALIA_FACTURACION]: '04',
  [EVENT_TYPES.DETECCION_LANZADA_EVENTOS]: '05',
  [EVENT_TYPES.ANOMALIA_EVENTOS]: '06',
  [EVENT_TYPES.RESTAURACION_COPIA]: '07',
  [EVENT_TYPES.EXPORTACION_FACTURACION]: '08',
  [EVENT_TYPES.EXPORTACION_EVENTOS]: '09',
  [EVENT_TYPES.RESUMEN]: '10',
  [EVENT_TYPES.ALTA]: '90',
  [EVENT_TYPES.ANULACION]: '90',
  [EVENT_TYPES.ENVIO_INICIADO]: '90',
  [EVENT_TYPES.ENVIO_ACEPTADO]: '90',
  [EVENT_TYPES.ENVIO_RECHAZADO]: '90',
  [EVENT_TYPES.ENVIO_FALLIDO]: '90',
  [EVENT_TYPES.CERTIFICADO_ALTA]: '90',
  [EVENT_TYPES.CERTIFICADO_BAJA]: '90',
}

export interface EventActor {
  userId?: string | null
  email?: string | null
}

/**
 * Huella of an event, chaining it to the previous event.
 *
 * The nine fields, their order and their names come from the AEAT's technical
 * document «Detalle de las especificaciones técnicas para generación de la
 * huella o hash de los registros de facturación», v0.1.2, section 3.c. Two of
 * them are both literally called `NIF` — the producer's and the obliged
 * party's — and that repetition is deliberate: the name is the element's name
 * in the record, not a unique key.
 *
 * `ID` is the producer's identifier when it is not a Spanish NIF. NIF and ID
 * are mutually exclusive, and whichever is absent still appears in the string
 * with an empty value, per section 3 of the same document.
 *
 * Until August 2026 this used eight fields under invented names (`IDProductor`,
 * `NIFObligado`, `Huella`, `FechaHoraHusoEvento`). Every huella it produced was
 * wrong. Do not "tidy" these names: they are fixed by the AEAT, not by us.
 */
export function computeEventHuella(args: {
  /** Producer's NIF, when Spanish. Empty if identified by `producerOtroId`. */
  producerNif: string
  /** Producer's non-Spanish identifier. Empty when `producerNif` is given. */
  producerOtroId?: string
  systemId: string
  systemVersion: string
  installationId: string
  obligadoNif: string
  /** The AEAT's TipoEvento code, not our descriptive name. */
  eventType: string
  occurredAt: string
  previousHuella: string
}): string {
  const chain =
    `NIF=${args.producerNif.trim()}` +
    `&ID=${(args.producerOtroId ?? '').trim()}` +
    `&IdSistemaInformatico=${args.systemId.trim()}` +
    `&Version=${args.systemVersion.trim()}` +
    `&NumeroInstalacion=${args.installationId.trim()}` +
    `&NIF=${args.obligadoNif.trim()}` +
    `&TipoEvento=${args.eventType.trim()}` +
    `&HuellaEvento=${args.previousHuella.trim()}` +
    `&FechaHoraHusoGenEvento=${args.occurredAt.trim()}`
  return createHash('sha256').update(chain, 'utf8').digest('hex').toUpperCase()
}

/**
 * The huella as this code computed it before the AEAT's document arrived.
 *
 * Kept only so the anomaly detection can still verify events written back
 * then. Never use it to write a new event: it is the wrong format, and that is
 * precisely why it is named this way.
 */
export function computeEventHuellaLegacy(args: {
  producerNif: string; systemId: string; systemVersion: string
  installationId: string; obligadoNif: string; eventType: string
  occurredAt: string; previousHuella: string
}): string {
  const chain =
    `IDProductor=${args.producerNif}` +
    `&IdSistemaInformatico=${args.systemId}` +
    `&Version=${args.systemVersion}` +
    `&NumeroInstalacion=${args.installationId}` +
    `&NIFObligado=${args.obligadoNif}` +
    `&TipoEvento=${args.eventType}` +
    `&Huella=${args.previousHuella}` +
    `&FechaHoraHusoEvento=${args.occurredAt}`
  return createHash('sha256').update(chain, 'utf8').digest('hex').toUpperCase()
}

const MAX_ATTEMPTS = 3

/**
 * Record an event.
 *
 * Returns whether it was written. Callers are not expected to check: the
 * return value exists so the export and the tests can assert, not so that
 * ordinary code branches on it.
 */
export async function recordEvent(
  supabase: SupabaseClient,
  args: {
    orgId: string
    type: EventType
    detail?: Record<string, unknown>
    actor?: EventActor
    /** The obliged party's NIF. Read from the organization when not given. */
    obligadoNif?: string | null
  },
): Promise<boolean> {
  const db = supabase as any
  const sis = sistemaInformatico(args.orgId)

  let obligadoNif = args.obligadoNif ?? null
  let obligadoNombre: string | null = null
  {
    // The schema's ObligadoEmision carries name and NIF together, so both are
    // read even when the caller supplied the NIF.
    const { data: org } = await db.from('organizations').select('name, cif').eq('id', args.orgId).maybeSingle()
    obligadoNombre = org?.name ?? null
    if (!obligadoNif) obligadoNif = org?.cif ?? ''
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data: prev } = await db.rpc('verifactu_event_head', { p_org: args.orgId })
      const previousHuella = (typeof prev === 'string' ? prev : null) ?? ''
      const occurredAt = nowWithOffset()

      const codigo = AEAT_EVENT_CODE[args.type] ?? '90'
      const huella = computeEventHuella({
        producerNif: sis.NIF,
        systemId: sis.IdSistemaInformatico,
        systemVersion: sis.Version,
        installationId: sis.NumeroInstalacion,
        obligadoNif: obligadoNif ?? '',
        eventType: codigo,
        occurredAt,
        previousHuella,
      })

      // Shaped after EventosSIF.xsd. The element names are the schema's, so
      // that turning this into the XML of annex 5 is a serialization step and
      // not a translation.
      const registro = {
        IDVersion: '1.0',
        Evento: {
          SistemaInformatico: sis,
          ObligadoEmision: { NombreRazon: obligadoNombre, NIF: obligadoNif },
          FechaHoraHusoGenEvento: occurredAt,
          TipoEvento: codigo,
          ...(args.detail && Object.keys(args.detail).length
            ? { DatosPropiosEvento: args.detail }
            : {}),
          // TextMax100Type: our own name for the event, plus who caused it.
          // The AEAT code alone would collapse eight of our events into "90".
          OtrosDatosEvento: [args.type, args.actor?.email].filter(Boolean).join(' · ').slice(0, 100),
          Encadenamiento: previousHuella
            ? { EventoAnterior: { HuellaEvento: previousHuella } }
            : { PrimerEvento: 'S' },
          TipoHuella: '01',
          HuellaEvento: huella,
        },
      }

      const { error } = await db.from('verifactu_events').insert({
        organization_id: args.orgId,
        event_type: args.type,
        actor_user_id: args.actor?.userId ?? null,
        actor_email: args.actor?.email ?? null,
        detail: args.detail ?? {},
        occurred_at: occurredAt,
        huella,
        huella_anterior: previousHuella || null,
        registro_evento: registro,
      })

      if (!error) return true

      // Another event took this link. Read the advanced head and try again.
      if (error.code === '23505') continue

      console.error('[verifactu-events] could not record', args.type, error.message)
      return false
    } catch (err) {
      // Never let logging break what it is logging.
      console.error('[verifactu-events] could not record', args.type, err)
      return false
    }
  }

  console.error('[verifactu-events] gave up recording', args.type, 'after', MAX_ATTEMPTS, 'attempts')
  return false
}
