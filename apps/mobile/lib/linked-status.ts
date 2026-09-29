import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BadgeTone } from "@/components/ui";
import { quoteStatusKey, quoteStatusTone } from "@/lib/quote-status";

export type LinkedStatus = { labelKey: string; tone: BadgeTone };

/**
 * The real status of a library document that is the archived copy of an
 * order, albarán or invoice. Espejo de `apps/web/lib/hooks/use-linked-status.ts`.
 *
 * The copy keeps a `documents.status` of its own that nothing updates when
 * the order is accepted or the albarán invoiced, so lists said "Borrador" for
 * what Pedidos called "Aceptado". The status lives on the source record.
 * `labelKey` is a translation key.
 */
export async function fetchLinkedStatuses(orgId: string): Promise<Map<string, LinkedStatus>> {
  const [{ data: quotes }, { data: invoices }] = await Promise.all([
    supabase.from("quotes").select("kind, status, document_id").eq("organization_id", orgId).not("document_id", "is", null),
    supabase.from("invoices").select("*").eq("organization_id", orgId).not("document_id", "is", null),
  ]);
  const map = new Map<string, LinkedStatus>();
  for (const q of (quotes ?? []) as any[]) {
    map.set(q.document_id, { labelKey: `quoteStatus.${quoteStatusKey(q.kind, q.status)}`, tone: quoteStatusTone(q.kind, q.status) });
  }
  for (const i of (invoices ?? []) as any[]) {
    const paid = !!i.payment_date || i.payment_status === "paid";
    const cancelled = i.payment_status === "cancelled";
    map.set(i.document_id, cancelled
      ? { labelKey: "invoicing.states.rectified", tone: "red" }
      : paid ? { labelKey: "invoicing.paid", tone: "green" }
      : i.sent_at ? { labelKey: "invoicing.states.sent", tone: "blue" }
      : { labelKey: "invoicing.unpaid", tone: "yellow" });
  }
  return map;
}

export function useLinkedStatuses(orgId: string | null) {
  const [linked, setLinked] = useState<Map<string, LinkedStatus>>(new Map());
  const refresh = useCallback(async () => {
    if (!orgId) return;
    try { setLinked(await fetchLinkedStatuses(orgId)); } catch { /* lists fall back to the document's own status */ }
  }, [orgId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { linked, refreshLinked: refresh };
}
