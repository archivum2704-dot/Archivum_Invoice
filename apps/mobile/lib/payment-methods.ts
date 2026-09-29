/**
 * Formas de pago. Espejo de `apps/web/lib/payment-methods.ts` — misma lista
 * y mismos códigos, que se guardan tal cual en `invoices.payment_method`,
 * `documents.payment_method` y `companies.payment_method`. Las etiquetas
 * viven en las traducciones (`paymentMethods.<código>`).
 */
export const PAYMENT_METHODS = [
  "transfer", "direct_debit", "bizum", "credit_card", "cash",
  "promissory_note", "check", "paypal", "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);

/**
 * Fecha de vencimiento propuesta: fecha de la factura + plazo del cliente.
 * Devuelve "" si falta alguno de los dos, para no inventar un vencimiento.
 */
export function dueDateFromTerms(issueDate: string, dueDays: number | null | undefined): string {
  if (!issueDate || dueDays == null || !Number.isFinite(dueDays)) return "";
  const [y, m, d] = issueDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d + dueDays));
  return dt.toISOString().slice(0, 10);
}
