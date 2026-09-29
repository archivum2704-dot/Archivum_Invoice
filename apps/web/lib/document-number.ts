import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Un número de factura no puede repetirse dentro de la misma cuenta.
 *
 * Conviven dos formas de tener una factura emitida: emitirla en Facturación
 * (número asignado por `next_invoice_number`, registro VeriFactu, inmutable)
 * o subir a la Biblioteca una emitida fuera de Archivum (número escrito a
 * mano). Sin comprobarlo, la segunda podía llevar el mismo número que una de
 * la primera — FAC-2026-0001 dos veces en la misma cuenta, que es justo lo
 * que la normativa de facturación prohíbe (RD 1619/2012, art. 6.1.a: numeración
 * correlativa y única dentro de cada serie).
 *
 * Reglas:
 * - **Factura emitida** (`invoice_issued`): el número no puede coincidir con
 *   ninguna factura de Facturación ni con otra factura emitida de la Biblioteca.
 * - **Factura recibida** (`invoice_received`): el número lo pone el
 *   proveedor, así que solo choca con otra factura *del mismo proveedor*.
 *   Dos proveedores distintos pueden usar ambos «1/2026».
 * - El resto de tipos no se comprueba.
 *
 * Espejado en `apps/mobile/lib/document-number.ts`.
 */
export type NumberConflict = { kind: "invoice" | "document"; number: string }

const norm = (s: string) => s.trim().toUpperCase()

export async function findDocumentNumberConflict(
  supabase: SupabaseClient,
  opts: {
    orgId: string
    number: string
    documentType: string
    companyId?: string | null
    /** The document being edited, which must not collide with itself. */
    excludeDocumentId?: string | null
  },
): Promise<NumberConflict | null> {
  const number = norm(opts.number ?? "")
  if (!number) return null
  if (opts.documentType !== "invoice_issued" && opts.documentType !== "invoice_received") return null

  if (opts.documentType === "invoice_issued") {
    const { data: invs } = await supabase
      .from("invoices")
      .select("id, full_number, document_id")
      .eq("organization_id", opts.orgId)
      .not("full_number", "is", null)
    const hit = (invs ?? []).find((i: any) =>
      norm(i.full_number ?? "") === number &&
      // An invoice's own archived PDF is that invoice, not a second one.
      (!opts.excludeDocumentId || i.document_id !== opts.excludeDocumentId))
    if (hit) return { kind: "invoice", number: hit.full_number }
  }

  let q = supabase
    .from("documents")
    .select("id, document_number, company_id")
    .eq("organization_id", opts.orgId)
    .eq("document_type", opts.documentType)
    .not("document_number", "is", null)
  if (opts.documentType === "invoice_received") {
    q = opts.companyId ? q.eq("company_id", opts.companyId) : q.is("company_id", null)
  }
  const { data: docs } = await q
  const dup = (docs ?? []).find((d: any) =>
    d.id !== opts.excludeDocumentId && norm(d.document_number ?? "") === number)
  if (dup) return { kind: "document", number: dup.document_number }
  return null
}

/** Mensaje para el usuario. */
export function numberConflictMessage(c: NumberConflict, documentType: string): string {
  if (c.kind === "invoice") {
    return `El número ${c.number} ya lo usa una factura emitida en Facturación. Cada factura necesita un número único: usa otra serie o numeración para las facturas emitidas fuera de Archivum.`
  }
  return documentType === "invoice_received"
    ? `Ya hay una factura de este proveedor con el número ${c.number}. ¿La estás subiendo dos veces?`
    : `Ya hay otra factura emitida con el número ${c.number} en la Biblioteca. Cada factura necesita un número único.`
}
