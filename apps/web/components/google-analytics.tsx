"use client"

import { useEffect, useState } from "react"
import Script from "next/script"
import { usePathname } from "next/navigation"
import {
  CONSENT_EVENT, GA_MEASUREMENT_ID, clearAnalyticsCookies, isPublicPath, readConsent, type CookieConsent,
} from "@/lib/analytics-consent"

declare global {
  interface Window { dataLayer?: unknown[]; [key: `ga-disable-${string}`]: boolean | undefined }
}

/**
 * Google Analytics 4, solo en la web pública y solo con consentimiento
 * (lib/analytics-consent.ts).
 *
 * Una vez cargado, el script sigue en la página aunque se navegue a la
 * aplicación, así que en cualquier ruta privada se activa el interruptor
 * oficial `ga-disable-<ID>`, que impide a gtag enviar nada (tampoco las
 * vistas de página por historial ni los clics de la medición mejorada).
 */
export function GoogleAnalytics() {
  const pathname = usePathname()
  const [consent, setConsent] = useState<CookieConsent | null>(null)

  useEffect(() => {
    setConsent(readConsent())
    const onChange = (e: Event) => setConsent((e as CustomEvent<CookieConsent>).detail)
    window.addEventListener(CONSENT_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_EVENT, onChange)
  }, [])

  const isPublic = !!pathname && isPublicPath(pathname)

  useEffect(() => {
    window[`ga-disable-${GA_MEASUREMENT_ID}`] = !(consent === "granted" && isPublic)
    if (consent === "denied") clearAnalyticsCookies()
  }, [consent, isPublic])

  // Se carga en cuanto hay consentimiento y se está en una página pública; si
  // luego se navega a la aplicación, el interruptor de arriba lo deja mudo.
  if (consent !== "granted" || !isPublic) return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { allow_google_signals: false, allow_ad_personalization_signals: false });`}
      </Script>
    </>
  )
}
