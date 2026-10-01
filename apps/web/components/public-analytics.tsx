"use client"

import { usePathname } from "next/navigation"
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next"

// Vercel Analytics only measures the public website. The private app holds
// clients' invoices and documents, so no third party should observe it —
// not even anonymous page views (decision taken before signing the DPA).
//
// /auth is left out too: its URLs can carry one-time codes and reset tokens.
const PUBLIC_PATHS = new Set([
  "/",
  "/privacidad",
  "/cookies",
  "/terminos",
  "/declaracion-responsable",
])

function isPublicPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return PUBLIC_PATHS.has(normalized)
}

// Second guard: once loaded, the script stays in the page after a
// client-side navigation into the app, so every event is checked again by
// its own URL. The query string is dropped as well.
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url)
  if (!isPublicPath(url.pathname)) return null
  url.search = ""
  return { ...event, url: url.toString() }
}

export function PublicAnalytics() {
  const pathname = usePathname()
  if (!pathname || !isPublicPath(pathname)) return null
  return <Analytics beforeSend={beforeSend} />
}
