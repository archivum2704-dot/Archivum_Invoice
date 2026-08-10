/**
 * ClaveRegimen — códigos admitidos por el esquema de la AEAT.
 *
 * Tomados de `IdOperacionesTrascendenciaTributariaType` en
 * `SuministroInformacion.xsd` (docs/aeat/). El esquema fija **qué códigos son
 * válidos**; no dice qué significa cada uno.
 *
 * ⚠ **No hay descripciones aquí a propósito.** La lista L8 se sustituyó por
 * las listas **L8A** (IVA) y **L8B** (IGIC), y ninguna de las dos viene en la
 * documentación descargada. Poner aquí una descripción de memoria haría que un
 * usuario eligiera su régimen fiscal a partir de un texto que nadie ha
 * verificado, que es peor que no ofrecer la opción. Hasta tener L8A y L8B, el
 * selector muestra el código y quien lo cambie ha de saber cuál le
 * corresponde.
 *
 * El régimen general es el 01 y sigue siendo el valor por defecto.
 */
export const CLAVE_REGIMEN_CODES = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11',
  '14', '15', '17', '18', '19', '20', '21',
] as const

export type ClaveRegimen = typeof CLAVE_REGIMEN_CODES[number]

export const CLAVE_REGIMEN_GENERAL: ClaveRegimen = '01'

/** El único que podemos describir sin inventar nada. */
export const CLAVE_REGIMEN_LABELS: Partial<Record<ClaveRegimen, string>> = {
  '01': 'Régimen general',
}

/**
 * Normalise whatever is stored into a code the schema accepts.
 *
 * An unrecognised value falls back to the general regime rather than being
 * sent as-is: the AEAT rejects the whole record over an invalid code, and a
 * rejected invoice is a worse outcome than one filed under the general regime
 * that its owner can then correct.
 */
export function claveRegimen(value: string | null | undefined): ClaveRegimen {
  const v = (value ?? '').trim()
  return (CLAVE_REGIMEN_CODES as readonly string[]).includes(v)
    ? (v as ClaveRegimen)
    : CLAVE_REGIMEN_GENERAL
}
