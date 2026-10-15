/**
 * Clientes y proveedores (20261015_company_kind.sql).
 *
 * Los dos viven en `companies`, distinguidos por `kind`: un mismo CIF/NIF es
 * un solo registro aunque le vendas y le compres ('both'). Las ventas
 * (pedidos, albaranes, facturas emitidas) eligen entre clientes; las
 * facturas recibidas, entre proveedores. Espejado en
 * `apps/mobile/lib/company-kind.ts`: si cambias uno, cambia el otro.
 *
 * Sin la migración aplicada no hay columna `kind`: todo se lee como cliente,
 * que es lo que había.
 */

export type CompanyKind = "client" | "supplier" | "both"
export type CompanyRole = "client" | "supplier"

type HasKind = { kind?: string | null }

export function kindOf(c: HasKind): CompanyKind {
  return c.kind === "supplier" || c.kind === "both" ? c.kind : "client"
}

export const isClient = (c: HasKind) => kindOf(c) !== "supplier"
export const isSupplier = (c: HasKind) => kindOf(c) !== "client"
export const hasRole = (c: HasKind, role: CompanyRole) => role === "client" ? isClient(c) : isSupplier(c)

/** The kind once `role` is added to what the company already is. */
export function withRole(c: HasKind, role: CompanyRole): CompanyKind {
  return hasRole(c, role) ? kindOf(c) : "both"
}

/** Who a document is with: the supplier of a purchase, the client of anything sold. */
export function roleForDocType(type: string | null | undefined): CompanyRole | null {
  if (type === "invoice_received") return "supplier"
  if (type === "invoice_issued" || type === "quote" || type === "delivery_note" || type === "order") return "client"
  return null
}

/**
 * Companies to offer in a picker. `keepId` stays even without the role, so
 * a document already filed under a company keeps showing it.
 */
export function forRole<C extends HasKind & { id: string }>(list: C[], role: CompanyRole | null, keepId?: string | null): C[] {
  if (!role) return list
  return list.filter(c => hasRole(c, role) || (!!keepId && c.id === keepId))
}
