/**
 * How a client is identified to the AEAT.
 *
 * A Spanish client has a NIF and needs nothing else. A foreign one has no NIF,
 * so the record carries a country plus one of these document types — the
 * AEAT's L7 list. Getting this wrong is not cosmetic: sending a foreign
 * identifier in the NIF field declares something untrue.
 */
export const TAX_ID_TYPES = [
  { code: '02', es: 'NIF-IVA (operador intracomunitario)', en: 'VAT number (EU operator)' },
  { code: '03', es: 'Pasaporte', en: 'Passport' },
  { code: '04', es: 'Documento oficial del país de residencia', en: 'Official document from country of residence' },
  { code: '05', es: 'Certificado de residencia fiscal', en: 'Tax residency certificate' },
  { code: '06', es: 'Otro documento probatorio', en: 'Other supporting document' },
  { code: '07', es: 'No censado', en: 'Not registered' },
] as const

export type TaxIdType = typeof TAX_ID_TYPES[number]['code']

/** True when the client needs the IDOtro block rather than a NIF. */
export const isForeignClient = (countryCode?: string | null) =>
  !!countryCode && countryCode.toUpperCase() !== 'ES'
