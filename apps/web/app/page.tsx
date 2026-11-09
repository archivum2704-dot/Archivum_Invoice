import type { Metadata } from "next"
import { cookies } from "next/headers"
import { SessionGate } from "@/components/landing/session-gate"
import { LandingPage } from "@/components/landing/landing-page"

const TITLE = "Archivum · Facturas y documentos en orden, listos para tu gestoría"
const DESCRIPTION =
  "Factura, organiza tus documentos y compártelos con tu gestoría desde un mismo lugar. Pedidos, albaranes, facturas con huella y QR VeriFactu, inventario y archivo. Empieza gratis."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://www.archivum.es/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://www.archivum.es/",
    siteName: "Archivum",
    locale: "es_ES",
    type: "website",
  },
}

export default async function Page() {
  // Una cookie de sesión de Supabase (sb-…-auth-token) indica que puede haber
  // sesión: solo entonces se retrasa la landing para comprobarla y redirigir
  // al panel. Las visitas anónimas reciben la landing ya renderizada.
  const maybeSignedIn = (await cookies())
    .getAll()
    .some(c => c.name.startsWith("sb-") && c.name.includes("auth-token"))

  return (
    <SessionGate maybeSignedIn={maybeSignedIn}>
      <LandingPage />
    </SessionGate>
  )
}
