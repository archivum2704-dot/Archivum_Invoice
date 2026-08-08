/**
 * Causas de exención de IVA — lista L10 de la Orden HAC/1177/2024.
 *
 * A line at 0% is exempt, and the record has to say under which article. There
 * is no safe default: declaring an export (art. 21) as an article 20 exemption
 * is a false statement about the operation, not a rounding of it. So the app
 * asks, and only when the user has said the line is exempt.
 */
export const EXEMPTION_CAUSES = [
  { code: 'E1', es: 'Exenta por el artículo 20 (educación, sanidad, seguros, financieras…)', en: 'Exempt under article 20' },
  { code: 'E2', es: 'Exenta por el artículo 21 (exportaciones)', en: 'Exempt under article 21 (exports)' },
  { code: 'E3', es: 'Exenta por el artículo 22 (operaciones asimiladas a exportaciones)', en: 'Exempt under article 22' },
  { code: 'E4', es: 'Exenta por los artículos 23 y 24 (regímenes aduaneros y depósitos)', en: 'Exempt under articles 23 and 24' },
  { code: 'E5', es: 'Exenta por el artículo 25 (entregas intracomunitarias)', en: 'Exempt under article 25 (intra-EU supplies)' },
  { code: 'E6', es: 'Exenta por otros motivos', en: 'Exempt on other grounds' },
] as const

export type ExemptionCause = typeof EXEMPTION_CAUSES[number]['code']

/** The short label, for tight places like a table cell. */
export const exemptionShort = (code: string) =>
  ({ E1: 'Art. 20', E2: 'Art. 21', E3: 'Art. 22', E4: 'Arts. 23-24', E5: 'Art. 25', E6: 'Otros' }[code] ?? code)
