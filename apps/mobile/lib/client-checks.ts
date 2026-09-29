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
 * Both are warnings, not refusals: branches of one company can share a
 * name, and the user decides. Espejo de `apps/web/lib/client-checks.ts`.
 */

export type ClientLike = { id: string; name: string; cif: string | null }

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
  draft: { name: string; cif: string },
  excludeId?: string | null,
): { sameCif: ClientLike | null; sameName: ClientLike | null } {
  const others = existing.filter(c => c.id !== excludeId)
  const cif = normalizeTaxId(draft.cif)
  const name = normalizeName(draft.name)
  const sameCif = cif ? others.find(c => c.cif && normalizeTaxId(c.cif) === cif) ?? null : null
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

/** Warning texts, in Spanish like the rest of the client form's messages. */
export function duplicateWarnings(r: ReturnType<typeof findSimilarClients>): string[] {
  const out: string[] = []
  if (r.sameCif) out.push(`Ya existe un cliente con este CIF/NIF: «${r.sameCif.name}». Seguramente sea el mismo; revisa antes de crear otro.`)
  if (r.sameName) out.push(`Ya existe un cliente llamado «${r.sameName.name}»${r.sameName.cif ? ` (CIF ${r.sameName.cif})` : ""}. Comprueba que no sea el mismo.`)
  return out
}
