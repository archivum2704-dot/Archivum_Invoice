/**
 * Líneas de una factura de compra (factura recibida de un proveedor).
 *
 * Se guardan en `document_items`. El stock NO se toca desde aquí: lo ajusta
 * la base de datos (trigger `trg_purchase_item_stock`, migración
 * 20261004_purchase_invoice_lines) al insertar, editar o borrar líneas, y al
 * anular la factura o cambiarle el tipo. Así web y móvil no pueden divergir.
 *
 * Copiado tal cual en apps/mobile/lib/purchase-lines.ts — si cambias uno,
 * cambia el otro.
 */

/** Tipo de documento al que se le pueden poner líneas de compra. */
export const PURCHASE_DOC_TYPE = "invoice_received"

/** Una línea tal como se edita en un formulario (los números son texto). */
export type PurchaseLine = {
  productId: string | null
  description: string
  quantity: string
  /** Precio de coste por unidad, sin IVA. */
  unitPrice: string
  taxRate: string
}

/** Fila de `document_items` tal como se lee de la base de datos. */
export type PurchaseItemRow = {
  id?: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  position?: number
}

export const emptyPurchaseLine = (): PurchaseLine => ({
  productId: null, description: "", quantity: "1", unitPrice: "", taxRate: "21",
})

/** "1.234,56" o "1234.56" → 1234.56. Texto vacío o no numérico → 0. */
export function parseAmount(v: string): number {
  const s = v.trim()
  if (!s) return 0
  // Con coma decimal, los puntos son de millares; sin coma, el punto es decimal.
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Base de la línea (cantidad × precio), redondeada como la guarda la BD. */
export function lineBase(l: PurchaseLine): number {
  return round2(parseAmount(l.quantity) * parseAmount(l.unitPrice))
}

/**
 * Totales de la factura. Misma aritmética que `update_document_totals()` en
 * la base de datos: IVA y total se suman sin redondear por línea y se
 * redondean al final.
 */
export function purchaseTotals(lines: PurchaseLine[]) {
  let subtotal = 0, tax = 0
  for (const l of lines) {
    const base = lineBase(l)
    subtotal += base
    tax += base * parseAmount(l.taxRate) / 100
  }
  return { subtotal: round2(subtotal), tax: round2(tax), total: round2(subtotal + tax) }
}

/** Una línea cuenta si tiene descripción o producto. Las vacías se ignoran. */
export function isFilledLine(l: PurchaseLine): boolean {
  return l.description.trim() !== "" || l.productId != null
}

/** Primer problema que impide guardar, o null. */
export function validatePurchaseLines(lines: PurchaseLine[]): string | null {
  for (const [i, l] of lines.filter(isFilledLine).entries()) {
    const n = i + 1
    if (!l.description.trim()) return `Línea ${n}: falta la descripción.`
    if (parseAmount(l.quantity) <= 0) return `Línea ${n}: la cantidad debe ser mayor que 0.`
    if (parseAmount(l.unitPrice) < 0) return `Línea ${n}: el precio no puede ser negativo.`
  }
  return null
}

/** Líneas del formulario → filas para insertar en `document_items`. */
export function toItemRows(documentId: string, lines: PurchaseLine[]) {
  return lines.filter(isFilledLine).map((l, i) => ({
    document_id: documentId,
    product_id:  l.productId,
    description: l.description.trim(),
    quantity:    parseAmount(l.quantity),
    unit_price:  parseAmount(l.unitPrice),
    tax_rate:    parseAmount(l.taxRate),
    position:    i,
  }))
}

/** Filas de `document_items` → líneas del formulario. */
export function fromItemRows(rows: PurchaseItemRow[]): PurchaseLine[] {
  return [...rows]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(r => ({
      productId:   r.product_id,
      description: r.description,
      quantity:    String(Number(r.quantity)).replace(".", ","),
      unitPrice:   Number(r.unit_price).toFixed(2).replace(".", ","),
      taxRate:     String(Number(r.tax_rate)),
    }))
}

/**
 * Sustituye las líneas de un documento por las del formulario.
 *
 * Borrar y volver a insertar es correcto también para el stock: el trigger
 * resta lo que tenían las líneas viejas y suma lo de las nuevas.
 */
export async function replacePurchaseItems(
  supabase: any,
  documentId: string,
  lines: PurchaseLine[],
): Promise<void> {
  const { error: delErr } = await supabase.from("document_items").delete().eq("document_id", documentId)
  if (delErr) throw delErr
  const rows = toItemRows(documentId, lines)
  if (rows.length === 0) return
  const { error: insErr } = await supabase.from("document_items").insert(rows)
  if (insErr) throw insErr
}
