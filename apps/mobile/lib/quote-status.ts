import type { BadgeTone } from "@/components/ui";

/**
 * Qué se muestra como estado de un pedido o de un albarán. Espejo de
 * `apps/web/lib/quote-status.ts`:
 *
 * - Un **pedido** está *pendiente* hasta que se acepta (a mano, o solo cuando
 *   su albarán se factura).
 * - Un **albarán** está *facturado* o *no facturado*.
 *
 * Las etiquetas son claves de traducción bajo `quoteStatus`.
 */
export function quoteStatusKey(kind: string | null | undefined, status: string): string {
  if (kind === "delivery_note") return status === "converted" ? "billed" : "unbilled";
  switch (status) {
    case "draft":     return "draft";
    case "accepted":
    case "converted": return "accepted";
    case "rejected":  return "rejected";
    default:          return "pending";
  }
}

export function quoteStatusTone(kind: string | null | undefined, status: string): BadgeTone {
  switch (quoteStatusKey(kind, status)) {
    case "billed":
    case "accepted": return "green";
    case "rejected": return "red";
    case "draft":    return "neutral";
    default:         return "yellow";
  }
}

/** Un pedido finalizado (no borrador) se puede marcar como aceptado o devolver a pendiente. */
export const canToggleAccepted = (status: string) => status === "sent" || status === "accepted";
