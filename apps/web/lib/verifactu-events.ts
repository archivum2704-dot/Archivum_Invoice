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

export interface EventActor {
  userId?: string | null
  email?: string | null
}

/**
 * Huella of an event, chaining it to the previous event.
 *
 * The field subset is the one article 13.1.c of the Orden HAC/1177/2024 fixes:
 * producer id, system id, system version, installation number, NIF of the
 * obliged party, event type, previous event's huella, and the timestamp with
 * its zone. An earlier version of this used the organization id and the event
 * type alone — four fields where the Orden requires eight, which would have
 * produced huellas the AEAT rejects.
 *
 * ⚠ The concatenation format and encoding are not in the Orden: article 13.2
 * defers them to a technical document on the AEAT's site, which we do not
 * have. The separator style below follows the billing records. Confirm before
 * relying on it — a wrong format yields a plausible huella that is wrong.
 */
function computeEventHuella(args: {
  producerNif: string
  systemId: string
  systemVersion: string
  installationId: string
  obligadoNif: string
  eventType: string
  occurredAt: string
  previousHuella: string
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
  if (!obligadoNif) {
    const { data: org } = await db.from('organizations').select('cif').eq('id', args.orgId).maybeSingle()
    obligadoNif = org?.cif ?? ''
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data: prev } = await db.rpc('verifactu_event_head', { p_org: args.orgId })
      const previousHuella = (typeof prev === 'string' ? prev : null) ?? ''
      const occurredAt = nowWithOffset()

      const huella = computeEventHuella({
        producerNif: sis.NIF,
        systemId: sis.IdSistemaInformatico,
        systemVersion: sis.Version,
        installationId: sis.NumeroInstalacion,
        obligadoNif: obligadoNif ?? '',
        eventType: args.type,
        occurredAt,
        previousHuella,
      })

      const registro = {
        IDVersion: '1.0',
        TipoEvento: args.type,
        FechaHoraHusoEvento: occurredAt,
        SistemaInformatico: sis,
        NIFObligado: obligadoNif,
        ...(args.actor?.email ? { Usuario: args.actor.email } : {}),
        DatosEvento: args.detail ?? {},
        // The Orden calls this grouping "EventoAnterior" for events (art. 9.3).
        EventoAnterior: previousHuella
          ? { Huella: previousHuella }
          : { PrimerRegistro: 'S' },
        TipoHuella: '01',
        Huella: huella,
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
