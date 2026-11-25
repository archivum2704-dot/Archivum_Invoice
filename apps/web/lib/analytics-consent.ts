/**
 * Analítica de la web pública: qué páginas se miden y el consentimiento de
 * cookies que lo permite.
 *
 * - Solo se mide la web pública. La aplicación guarda facturas y documentos
 *   de clientes y ningún tercero debe observarla (decisión del 1 de octubre,
 *   antes de firmar el DPA). /auth también queda fuera: sus URL llevan códigos
 *   de un solo uso.
 * - Google Analytics pone cookies que no son técnicas, así que la LSSI (art.
 *   22.2) exige consentimiento previo: no se carga nada hasta que se pulsa
 *   «Aceptar». Rechazar es igual de fácil y se puede cambiar en cualquier
 *   momento desde «Configurar cookies».
 */

/** ID de medición de GA4 (flujo «Archivum flow»). Es público: va en el HTML. */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-DGRPVY5M0R"

export const PUBLIC_PATHS = new Set([
  "/",
  "/privacidad",
  "/cookies",
  "/terminos",
  "/encargo-tratamiento",
  "/eliminar-cuenta",
  "/declaracion-responsable",
])

export function isPublicPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return PUBLIC_PATHS.has(normalized)
}

export type CookieConsent = "granted" | "denied"

const STORAGE_KEY = "archivum_cookie_consent"
/** Súbelo si cambian las cookies que se piden: vuelve a preguntar a todos. */
const CONSENT_VERSION = 1
/** La AEPD recomienda no guardar la elección más de 24 meses. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365 * 2
export const CONSENT_EVENT = "archivum:cookie-consent"
export const OPEN_SETTINGS_EVENT = "archivum:cookie-settings"

export function readConsent(): CookieConsent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { value?: string; version?: number; at?: number }
    if (v.version !== CONSENT_VERSION || !v.at || Date.now() - v.at > MAX_AGE_MS) return null
    return v.value === "granted" || v.value === "denied" ? v.value : null
  } catch {
    return null
  }
}

export function saveConsent(value: CookieConsent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, version: CONSENT_VERSION, at: Date.now() }))
  } catch { /* sin almacenamiento: se volverá a preguntar */ }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))
}

/** Borra las cookies de Google Analytics (_ga, _ga_XXXX) al retirar el consentimiento. */
export function clearAnalyticsCookies() {
  const host = window.location.hostname
  const domains = ["", host, `.${host}`, `.${host.replace(/^www\./, "")}`]
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim()
    if (!name || !name.startsWith("_ga")) continue
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`
    }
  }
}
