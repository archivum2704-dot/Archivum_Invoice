"use client"

import { usePathname } from "next/navigation"
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next"
import { isPublicPath } from "@/lib/analytics-consent"

// Vercel Analytics only measures the public website (lib/analytics-consent.ts
// decides which pages count). The private app holds clients' invoices and
// documents, so no third party should observe it. It sets no cookies, so it
// runs without the consent that Google Analytics needs.

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
