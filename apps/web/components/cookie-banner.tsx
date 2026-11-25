"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { OPEN_SETTINGS_EVENT, isPublicPath, readConsent, saveConsent } from "@/lib/analytics-consent"

/**
 * Aviso de cookies de la web pública. Aceptar y Rechazar tienen el mismo peso,
 * como pide la guía de la AEPD; no se carga ninguna cookie de analítica hasta
 * aceptar. «Configurar cookies» (pie de página y /cookies) lo vuelve a abrir.
 */
export function CookieBanner() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (readConsent() === null) setOpen(true)
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_SETTINGS_EVENT, reopen)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, reopen)
  }, [])

  if (!open || !pathname || !isPublicPath(pathname)) return null

  const choose = (value: "granted" | "denied") => { saveConsent(value); setOpen(false) }
  const btn = "flex-1 sm:flex-none rounded-full px-5 py-2.5 text-sm font-bold transition-colors"

  return (
    <div role="dialog" aria-live="polite" aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md">
      <div className="rounded-2xl border border-border bg-background p-5 shadow-[0_20px_50px_-20px_rgba(26,45,73,0.45)]">
        <p className="text-sm font-bold text-foreground">Cookies</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Usamos cookies de Google Analytics para saber cómo se usa esta web y mejorarla. Solo en la web pública,
          nunca dentro de la aplicación. Puedes aceptarlas o rechazarlas, y cambiar de opinión cuando quieras.{" "}
          <Link href="/cookies" className="font-semibold text-primary hover:underline">Más información</Link>
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => choose("denied")} className={`${btn} border border-border text-foreground hover:bg-muted`}>
            Rechazar
          </button>
          <button type="button" onClick={() => choose("granted")} className={`${btn} border border-primary bg-primary text-primary-foreground hover:opacity-90`}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}

/** Enlace «Configurar cookies» para el pie de página. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}>
      Configurar cookies
    </button>
  )
}
