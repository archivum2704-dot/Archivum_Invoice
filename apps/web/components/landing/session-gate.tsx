"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

/**
 * La landing se sirve ya renderizada (para buscadores y para que pinte al
 * instante). Solo cuando el navegador trae una cookie de sesión de Supabase
 * se espera a comprobarla: si la sesión es válida se va al panel, y si no,
 * se muestra la landing.
 */
export function SessionGate({ maybeSignedIn, children }: { maybeSignedIn: boolean; children: ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(maybeSignedIn)

  useEffect(() => {
    if (!maybeSignedIn) return
    let cancelled = false
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return
        if (session) router.replace("/dashboard")
        else setChecking(false)
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [maybeSignedIn, router])

  if (checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return <>{children}</>
}
