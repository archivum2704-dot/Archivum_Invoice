/**
 * Checks when a client (or supplier) is created or edited (WEB-004).
 *
 * Two records for the same company let you invoice the wrong one, or split
 * one client's history in two. The auditors found it easy to do: nothing
 * warned, and the CIF/NIF was optional.
 *
 * - The CIF/NIF is required. A Spanish invoice must carry the recipient's
 *   (RD 1619/2012, art. 6.1.d), and it is the only reliable identity.
 * - Same CIF/NIF as an existing client: almost certainly the same company.
 * - Same name (ignoring case, accents, punctuation and the legal form, so
 *   "García S.L." = "GARCIA, SL"): probably the same, possibly not.
 * A repeated CIF/NIF is refused; a repeated name only warns, since two
 * different companies can share one. Espejo de `apps/web/lib/client-checks.ts`.
 */

export type ClientLike = { id: string; name: string; cif: string | null; parent_company_id?: string | null }

/**
 * A client is either *principal* or an *establishment* (local, delegación)
 * of one: `companies.parent_company_id` points at the principal. The CIF/NIF
 * is unique among principals; establishments share their principal's, since
 * it is the same taxpayer with another address (e.g. two shops of one
 * autónomo). One level only: an establishment has no establishments.
 */
export const isPrincipal = (c: ClientLike) => !c.parent_company_id

/** Principals a client may be filed under (not itself, not an establishment). */
export function principalOptions<C extends ClientLike>(existing: C[], selfId?: string | null): C[] {
  return existing.filter(c => isPrincipal(c) && c.id !== selfId).sort((a, b) => a.name.localeCompare(b.name))
}

const LEGAL_FORMS = /\b(s\.?\s?l\.?\s?u?|s\.?\s?a\.?\s?u?|s\.?\s?c\.?|s\.?\s?l\.?\s?l\.?|c\.?\s?b\.?|sociedad limitada|sociedad anonima|ltd|llc|inc|gmbh|sarl|sas)\.?$/i

export function normalizeName(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,;:'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEGAL_FORMS, "")
    .replace(/[\s-]+/g, "")
}

export const normalizeTaxId = (cif: string) => cif.toUpperCase().replace(/[\s.\-/]/g, "")

export function findSimilarClients(
  existing: ClientLike[],
  draft: { name: string; cif: string; parentId?: string | null },
  excludeId?: string | null,
): { sameCif: ClientLike | null; sameName: ClientLike | null } {
  const others = existing.filter(c => c.id !== excludeId)
  const cif = normalizeTaxId(draft.cif)
  const name = normalizeName(draft.name)
  // An establishment shares its principal's CIF by design; only a second
  // *principal* with the same CIF is a duplicate.
  const sameCif = cif && !draft.parentId
    ? others.find(c => isPrincipal(c) && c.cif && normalizeTaxId(c.cif) === cif) ?? null
    : null
  const sameName = name ? others.find(c => normalizeName(c.name) === name && c.id !== sameCif?.id) ?? null : null
  return { sameCif, sameName }
}

/**
 * Whether a Spanish NIF / NIE / CIF has a plausible shape (checksum not
 * verified). Only used to warn: a foreign tax id has other formats.
 */
export function looksLikeSpanishTaxId(cif: string): boolean {
  const v = normalizeTaxId(cif)
  return /^(\d{8}[A-Z]|[XYZ]\d{7}[A-Z]|[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J])$/.test(v)
}

/**
 * The same CIF/NIF is the same company: that one blocks. The database
 * enforces it too (uq_companies_org_cif, 20260930_company_cif_unique.sql).
 */
export function cifTakenMessage(r: ReturnType<typeof findSimilarClients>): string | null {
  return r.sameCif
    ? `Ya existe un cliente con este CIF/NIF: «${r.sameCif.name}». Si es otro local o delegación suyo, créalo como establecimiento de ese cliente.`
    : null
}

/** Label for pickers: "Local Villarcayo · establecimiento de Hassan Azeem". */
export function clientLabel(c: ClientLike, all: ClientLike[]): string {
  const parent = c.parent_company_id ? all.find(p => p.id === c.parent_company_id) : null
  return parent ? `${c.name} · establecimiento de ${parent.name}` : c.name
}

/** A shared name only warns: two different companies can be called alike. */
export function duplicateWarnings(r: ReturnType<typeof findSimilarClients>): string[] {
  return r.sameName
    ? [`Ya existe un cliente llamado «${r.sameName.name}»${r.sameName.cif ? ` (CIF ${r.sameName.cif})` : ""}. Comprueba que no sea el mismo.`]
    : []
}

/** Postgres errors from saving a client, in words (unique CIF / CIF required). */
export function explainCompanyError(err: { code?: string; message?: string }, fallback: string): string {
  if (err.code === "23505") return "Ya existe un cliente principal con este CIF/NIF. Si es otro local suyo, créalo como establecimiento de ese cliente."
  if (/establecimiento/i.test(err.message ?? "")) return err.message!
  if (err.code === "23514" || /CIF\/NIF del cliente es obligatorio/.test(err.message ?? "")) return "El CIF/NIF del cliente es obligatorio."
  if (err.code === "42501") return "Tu usuario no tiene permiso para guardar clientes. Pídeselo a un administrador de la organización."
  return err.message ?? fallback
}
