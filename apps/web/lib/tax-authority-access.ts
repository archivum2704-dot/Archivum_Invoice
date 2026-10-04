/**
 * Acceso de la Administración tributaria (RD 1007/2023, art. 8.4 y 14).
 *
 * La AEAT lo resuelve en su propio ejemplo de declaración responsable
 * (apartado 2.c): un «check», desmarcado por defecto, que se elige antes de
 * entrar y deja la sesión limitada a la información con trascendencia
 * tributaria — los registros de facturación y de eventos y su consulta —,
 * ocultando la información confidencial de carácter no patrimonial
 * (Biblioteca, clientes, inventario, usuarios, ajustes…).
 *
 * El modo vive en una cookie de sesión (sin caducidad: muere al cerrar el
 * navegador) que se pone al iniciar sesión con la casilla marcada y se borra
 * al salir. El middleware (lib/supabase/proxy.ts) redirige cualquier otra
 * página y rechaza las escrituras por API; la interfaz además se queda en
 * solo lectura.
 */

export const TAX_ACCESS_COOKIE = "archivum_tax_access"

/** Páginas que se pueden abrir en este modo (prefijos). */
export const TAX_ACCESS_PAGES = [
  "/facturacion",                     // facturas emitidas: listado y detalle
  "/configuracion/verifactu/eventos", // registro de eventos + exportación de registros
  "/declaracion-responsable",
] as const

/** Adonde se entra en este modo. */
export const TAX_ACCESS_HOME = "/facturacion"

export function isTaxAccessPage(pathname: string): boolean {
  return TAX_ACCESS_PAGES.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

/** Lectura en el navegador. En el servidor se usa request.cookies. */
export function readTaxAccessCookie(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split("; ").some(c => c === `${TAX_ACCESS_COOKIE}=1`)
}

export function setTaxAccessCookie(on: boolean): void {
  if (typeof document === "undefined") return
  document.cookie = on
    ? `${TAX_ACCESS_COOKIE}=1; path=/; SameSite=Lax`
    : `${TAX_ACCESS_COOKIE}=; path=/; max-age=0; SameSite=Lax`
}
