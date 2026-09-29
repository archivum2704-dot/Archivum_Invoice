/**
 * Formas de pago. Una sola lista para facturas emitidas, facturas recibidas
 * (documentos) y la ficha de cliente/proveedor, espejada en
 * `apps/mobile/lib/payment-methods.ts`. Las etiquetas viven en las
 * traducciones (`documents.paymentMethods.<código>`).
 *
 * Los códigos se guardan tal cual en `invoices.payment_method`,
 * `documents.payment_method` y `companies.payment_method`: no renombrar uno
 * existente, o los registros ya guardados dejarían de tener etiqueta.
 */
export const PAYMENT_METHODS = [
  "transfer", "direct_debit", "bizum", "credit_card", "cash",
  "promissory_note", "check", "paypal", "other",
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v)

/**
 * Fecha de vencimiento propuesta: fecha de la factura + plazo del cliente.
 * Devuelve "" si falta alguno de los dos, para no inventar un vencimiento.
 */
export function dueDateFromTerms(issueDate: string, dueDays: number | null | undefined): string {
  if (!issueDate || dueDays == null || !Number.isFinite(dueDays)) return ""
  const [y, m, d] = issueDate.split("-").map(Number)
  if (!y || !m || !d) return ""
  const dt = new Date(Date.UTC(y, m - 1, d + dueDays))
  return dt.toISOString().slice(0, 10)
}

/**
 * Etiquetas en español para lo que se imprime (PDF de la factura), que no
 * pasa por next-intl. Deben coincidir con `documents.paymentMethods` en
 * `messages/es.json`.
 */
export const PAYMENT_METHOD_LABEL_ES: Record<PaymentMethod, string> = {
  transfer: "Transferencia bancaria",
  direct_debit: "Domiciliación bancaria",
  bizum: "Bizum",
  credit_card: "Tarjeta de crédito",
  cash: "Efectivo",
  promissory_note: "Pagaré",
  check: "Cheque",
  paypal: "PayPal",
  other: "Otro",
}

export const paymentMethodLabelEs = (v: string | null | undefined): string | null =>
  isPaymentMethod(v) ? PAYMENT_METHOD_LABEL_ES[v] : null
