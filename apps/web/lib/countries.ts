/**
 * Countries offered where a client's country is picked from a list (the Excel
 * import template). ISO 3166-1 alpha-2, which is what `companies.country_code`
 * stores and what VeriFactu's IDOtro expects. Names come from the browser's
 * Intl data, so no translated list has to be kept here.
 *
 * EU first (intra-community operations are the common foreign case), then the
 * usual trading partners. A code not on this list can still be typed.
 */
export const COUNTRY_CODES = [
  "ES", "PT", "FR", "DE", "IT", "NL", "BE", "LU", "IE", "AT", "PL", "CZ", "SK", "HU",
  "RO", "BG", "GR", "HR", "SI", "DK", "SE", "FI", "EE", "LV", "LT", "CY", "MT",
  "GB", "CH", "NO", "AD", "MC", "MA", "US", "CA", "MX", "AR", "CL", "CO", "PE", "BR",
  "CN", "JP", "IN", "AE", "TR",
] as const

export function countryName(code: string, locale = "es"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code
  } catch {
    return code
  }
}

/** "ES — España" — the form the template's dropdown offers. */
export const countryOption = (code: string, locale = "es") => `${code} — ${countryName(code, locale)}`

/**
 * Read what a user put in a country cell: a code ("es", "ES"), the dropdown
 * option ("ES — España") or a name ("España", "Spain"). Returns the code, or
 * null when it cannot be recognised.
 */
export function parseCountry(input: string): string | null {
  const v = input.trim()
  if (!v) return null
  const m = /^([A-Za-z]{2})(\s|$|—|-)/.exec(v)
  if (m) return m[1].toUpperCase()
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  const target = norm(v)
  for (const code of COUNTRY_CODES) {
    if (norm(countryName(code, "es")) === target || norm(countryName(code, "en")) === target) return code
  }
  return null
}
