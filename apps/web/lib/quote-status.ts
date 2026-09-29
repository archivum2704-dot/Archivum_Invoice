/**
 * Qué se muestra como estado de un pedido o de un albarán.
 *
 * Pedidos y albaranes comparten tabla (`quotes`, discriminada por `kind`) y
 * enum de estado, pero al usuario le importan dos cosas distintas:
 *
 * - Un **pedido** está *pendiente* hasta que se acepta. Se acepta a mano o,
 *   solo, cuando su albarán se factura (`/api/quotes/convert`).
 * - Un **albarán** está *facturado* o *no facturado*; nada más.
 *
 * Una sola tabla de etiquetas para la lista y el detalle — antes cada vista
 * tenía la suya y ya decían cosas distintas. Espejada en
 * `apps/mobile/lib/quote-status.ts`.
 */
export type QuoteKind = "quote" | "delivery_note"

const QUOTE_LABEL: Record<string, string> = {
  draft: "Borrador", sent: "Pendiente", accepted: "Aceptado", rejected: "Rechazado", converted: "Aceptado",
}
const NOTE_LABEL: Record<string, string> = {
  open: "No facturado", converted: "Facturado",
}

const STYLE: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground",
  pending:   "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  accepted:  "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  rejected:  "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
  billed:    "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  unbilled:  "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
}

export function quoteStatusLabel(kind: QuoteKind | string | null | undefined, status: string): string {
  if (kind === "delivery_note") return NOTE_LABEL[status] ?? NOTE_LABEL.open
  return QUOTE_LABEL[status] ?? status
}

export function quoteStatusStyle(kind: QuoteKind | string | null | undefined, status: string): string {
  if (kind === "delivery_note") return status === "converted" ? STYLE.billed : STYLE.unbilled
  switch (status) {
    case "draft":     return STYLE.draft
    case "accepted":
    case "converted": return STYLE.accepted
    case "rejected":  return STYLE.rejected
    default:          return STYLE.pending
  }
}

/** Un pedido finalizado (no borrador) se puede marcar como aceptado o devolver a pendiente. */
export const canToggleAccepted = (status: string) => status === "sent" || status === "accepted"
