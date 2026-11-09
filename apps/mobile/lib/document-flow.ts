/**
 * Sentido del dinero de un documento: ¿es un ingreso o un gasto?
 *
 * Una factura recibida (de un proveedor) es un GASTO: cuando está pagada, la
 * hemos pagado nosotros; no la hemos cobrado. Los totales del panel
 * («Cobrado», «Pendiente de cobro», «Ingresos del mes») no deben sumarla; va
 * en «Pagado» / «Pendiente de pago».
 *
 * Copiado tal cual en apps/web/lib/document-flow.ts — si cambias uno,
 * cambia el otro.
 */

/** Tipos de documento que son un gasto (dinero que sale). */
export const EXPENSE_DOC_TYPES: readonly string[] = ["invoice_received"]

export function isExpenseDoc(doc: { document_type?: string | null }): boolean {
  return !!doc.document_type && EXPENSE_DOC_TYPES.includes(doc.document_type)
}
