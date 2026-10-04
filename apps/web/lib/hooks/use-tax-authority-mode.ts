"use client"

import { useEffect, useState } from "react"
import { readTaxAccessCookie } from "@/lib/tax-authority-access"

/**
 * True while the session was opened with «Acceso de la Administración
 * tributaria» checked. Views use it to stay read-only; the middleware is what
 * actually keeps every other page out of reach.
 */
export function useTaxAuthorityMode(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => { setOn(readTaxAccessCookie()) }, [])
  return on
}
