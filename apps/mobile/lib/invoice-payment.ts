/**
 * Llevar el cobro de la copia archivada de una factura a la factura de verdad.
 *
 * Una factura emitida tiene una copia en la Biblioteca (`documents`), y lo que
 * se ve en la Biblioteca, el Panel y la ficha es el estado de la factura
 * (lib/hooks/use-linked-status.ts), no el de la copia. Marcar la copia como
 * «Pagado» desde Editar solo cambiaba `documents.status`: la factura seguía
 * sin cobrar y todo seguía diciendo «Pendiente de cobro».
 *
 * Solo toca las columnas de cobro, que la inalterabilidad no protege. Una
 * factura anulada (`cancelled`) no se toca. Copia idéntica de
 * apps/web/lib/invoice-payment.ts.
 */

/** Estado de la copia → cobro de la factura. Otros estados no la cambian. */
export function invoicePaymentFromDocStatus(status: string, paymentDate: string | null): { paid: boolean; date: string | null } | null {
  if (status === "paid") return { paid: true, date: paymentDate || new Date().toISOString().slice(0, 10) }
  if (status === "pending" || status === "overdue") return { paid: false, date: null }
  return null
}

/**
 * Devuelve la fecha de cobro que ha quedado (para guardarla también en la
 * copia), o `undefined` si la factura no se ha tocado.
 */
export async function syncInvoicePaymentFromDocument(
  supabase: any,
  documentId: string,
  status: string,
  paymentDate: string | null,
  paymentMethod: string | null,
): Promise<string | null | undefined> {
  const payment = invoicePaymentFromDocStatus(status, paymentDate)
  if (!payment) return undefined
  const { data: invoice } = await supabase.from("invoices")
    .select("id, payment_status").eq("document_id", documentId).maybeSingle()
  if (!invoice || invoice.payment_status === "cancelled") return undefined
  const { error } = await supabase.from("invoices").update({
    payment_status: payment.paid ? "paid" : "pending",
    payment_date: payment.date,
    ...(paymentMethod ? { payment_method: paymentMethod } : {}),
  }).eq("id", invoice.id)
  if (error) throw error
  return payment.date
}
