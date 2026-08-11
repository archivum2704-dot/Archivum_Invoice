"use client"

import { Fragment } from "react"
import useSWR from "swr"
import Link from "next/link"
import { ArrowLeft, ScrollText, Download, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useOrganization } from "@/lib/context/organization-context"

/**
 * The event log, on screen.
 *
 * Article 8.3 does not only require the events to be recorded — they must be
 * consultable from within the system, which is what this page is for. It reads
 * them directly: the table is readable by the organization and writable by
 * nobody, so there is nothing an API route would add.
 */

type EventRow = {
  id: string
  event_type: string
  actor_email: string | null
  detail: Record<string, unknown>
  occurred_at: string
  huella: string
  huella_anterior: string | null
}

// Debe seguir a EVENT_TYPES de lib/verifactu-events.ts. No se importa de allí
// porque ese módulo usa `crypto` y esto es un componente de cliente; un tipo
// sin etiqueta se muestra con su nombre técnico, nunca en blanco.
const LABELS: Record<string, string> = {
  // Exigidos por el artículo 9.1 de la Orden
  deteccion_anomalias_facturacion_lanzada: "Detección de anomalías en facturación · lanzada",
  anomalia_facturacion_detectada: "Anomalía detectada en registros de facturación",
  deteccion_anomalias_eventos_lanzada: "Detección de anomalías en eventos · lanzada",
  anomalia_eventos_detectada: "Anomalía detectada en registros de evento",
  restauracion_copia_seguridad: "Restauración de copia de seguridad",
  exportacion_registros_facturacion: "Exportación de registros de facturación",
  exportacion_registros_evento: "Exportación de registros de evento",
  registro_resumen_eventos: "Registro resumen de eventos",
  // Propios
  registro_alta_generado: "Registro de alta generado",
  registro_anulacion_generado: "Registro de anulación generado",
  envio_aeat_iniciado: "Envío a la AEAT iniciado",
  envio_aeat_aceptado: "Envío aceptado por la AEAT",
  envio_aeat_rechazado: "Envío rechazado por la AEAT",
  envio_aeat_fallido: "Envío a la AEAT fallido",
  certificado_subido: "Certificado digital subido",
  certificado_eliminado: "Certificado digital eliminado",
}

const TONE: Record<string, string> = {
  envio_aeat_aceptado: "text-[var(--status-paid)]",
  envio_aeat_rechazado: "text-[var(--status-overdue)]",
  envio_aeat_fallido: "text-[var(--status-overdue)]",
  anomalia_facturacion_detectada: "text-[var(--status-overdue)]",
  anomalia_eventos_detectada: "text-[var(--status-overdue)]",
  exportacion_registros_facturacion: "text-[var(--status-pending)]",
  exportacion_registros_evento: "text-[var(--status-pending)]",
}

/** Nombres legibles para las claves del detalle. Una clave sin traducir se
 *  muestra tal cual: es mejor que ocultarla. */
const DETAIL_LABELS: Record<string, string> = {
  total: "Total",
  totalEventos: "Eventos",
  anomalias: "Anomalías",
  desde: "Desde",
  hasta: "Hasta",
  porTipo: "Por tipo",
  sinEventos: "Sin actividad",
  fullNumber: "Factura",
  clientCif: "NIF del cliente",
  registrosDeAlta: "Registros de alta",
  registrosDeAnulacion: "Registros de anulación",
  cadenaIntegra: "Cadena íntegra",
  eventos: "Eventos",
  deteccion: "Detección",
  rupturas: "Rupturas",
  enviadas: "Enviadas",
  rechazadas: "Rechazadas",
}

/**
 * Un valor del detalle, en algo que se pueda leer.
 *
 * Antes se volcaba el objeto entero con JSON.stringify, lo que llenaba la
 * pantalla de llaves y comillas justo en los eventos que más importa entender
 * —los de anomalías—.
 */
function formatDetail(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "boolean") return v ? "Sí" : "No"
  if (typeof v === "number" || typeof v === "string") return String(v)
  if (Array.isArray(v)) {
    if (v.length === 0) return "ninguna"
    return v.map(x =>
      x && typeof x === "object"
        ? [(x as any).record, (x as any).detail].filter(Boolean).join(" — ")
        : String(x),
    ).join(" · ")
  }
  return Object.entries(v as Record<string, unknown>)
    .map(([k, val]) => `${DETAIL_LABELS[k] ?? k}: ${val}`)
    .join(" · ")
}

async function fetchEvents(orgId: string): Promise<EventRow[]> {
  const supabase: any = createClient()
  const { data, error } = await supabase
    .from("verifactu_events")
    .select("id, event_type, actor_email, detail, occurred_at, huella, huella_anterior")
    .eq("organization_id", orgId)
    .order("occurred_at", { ascending: false })
    .limit(500)
  if (error) throw error
  return data ?? []
}

export function EventosView() {
  const { currentOrg, isOrgAdmin } = useOrganization()
  const { data: events, isLoading, error } = useSWR(
    currentOrg?.id ? ["verifactu-events", currentOrg.id] : null,
    () => fetchEvents(currentOrg!.id),
    { revalidateOnFocus: false },
  )

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <Link href="/configuracion/verifactu" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> VeriFactu
      </Link>

      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2.5">
          <ScrollText className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Registro de eventos</h1>
        </div>
        {/* Dos exportaciones distintas: el artículo 9.1.i trata la de eventos
            como operación propia, con su propio tipo de evento. */}
        {isOrgAdmin && currentOrg && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={`/api/verifactu/export?orgId=${currentOrg.id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-card border border-border rounded-xl hover:bg-muted whitespace-nowrap transition-colors"
            >
              <Download className="w-4 h-4" /> Facturación
            </a>
            <a
              href={`/api/verifactu/export/eventos?orgId=${currentOrg.id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-card border border-border rounded-xl hover:bg-muted whitespace-nowrap transition-colors"
            >
              <Download className="w-4 h-4" /> Eventos
            </a>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Sucesos registrados automáticamente por el sistema, conforme al artículo 8.3 del RD 1007/2023.
        Los eventos son inmutables y están encadenados entre sí.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">No se pudo leer el registro de eventos.</p>
        </div>
      ) : !events?.length ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <ScrollText className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Todavía no hay eventos</p>
          <p className="text-xs text-muted-foreground mt-1">Se registran solos según se usa el sistema.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {events.map(e => (
            <div key={e.id} className="px-5 py-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <p className={cn("text-sm font-medium", TONE[e.event_type] ?? "text-foreground")}>
                  {LABELS[e.event_type] ?? e.event_type}
                </p>
                <time className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {new Date(e.occurred_at).toLocaleString("es-ES")}
                </time>
              </div>
              {e.actor_email && <p className="text-xs text-muted-foreground mt-0.5">{e.actor_email}</p>}
              {Object.keys(e.detail ?? {}).length > 0 && (
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  {Object.entries(e.detail).map(([k, v]) => (
                    <Fragment key={k}>
                      <dt className="text-xs text-muted-foreground/70 whitespace-nowrap">{DETAIL_LABELS[k] ?? k}</dt>
                      <dd className="text-xs text-foreground min-w-0 break-words">{formatDetail(v)}</dd>
                    </Fragment>
                  ))}
                </dl>
              )}
              <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono break-all">
                {e.huella.slice(0, 32)}…
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
