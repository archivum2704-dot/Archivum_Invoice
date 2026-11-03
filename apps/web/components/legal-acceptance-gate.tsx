"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { LEGAL_VERSION } from "@/lib/legal/version"
import { useTaxAuthorityMode } from "@/lib/hooks/use-tax-authority-mode"
import { LegalConsentCheckbox } from "@/components/legal-consent"

/**
 * Asks for the conditions in force once, then stays out of the way.
 *
 * Accounts created before 3 November 2026 never accepted the aviso legal or
 * the contrato de encargo (the sign-up had no checkbox), and every account has
 * to accept again when LEGAL_VERSION changes. The record is the user's
 * metadata (legal_version + legal_accepted_at), the same place sign-up writes
 * it. A tax-authority session (RD 1007/2023 art. 8.4) is someone inspecting,
 * not the client, so it is never asked.
 */
export function LegalAcceptanceGate() {
  const taxMode = useTaxAuthorityMode()
  const [needed, setNeeded] = useState(false)
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (taxMode) return
    createClient().auth.getUser().then(({ data }) => {
      if (data.user && data.user.user_metadata?.legal_version !== LEGAL_VERSION) setNeeded(true)
    })
  }, [taxMode])

  if (!needed || taxMode) return null

  const accept = async () => {
    setSaving(true); setError(null)
    const { error: err } = await createClient().auth.updateUser({
      data: { legal_version: LEGAL_VERSION, legal_accepted_at: new Date().toISOString() },
    })
    setSaving(false)
    if (err) { setError("No se pudo guardar la aceptación. Inténtalo de nuevo."); return }
    setNeeded(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4">
        <div className="flex items-start gap-3">
          <FileText className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Condiciones de Archivum</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Hemos publicado el Aviso legal, las Condiciones de uso y de contratación y el Contrato de encargo
              del tratamiento de datos. Para seguir usando Archivum tienes que aceptarlos.
            </p>
          </div>
        </div>
        <LegalConsentCheckbox checked={checked} onChange={setChecked} disabled={saving} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button onClick={accept} disabled={!checked || saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Aceptar y continuar
        </button>
      </div>
    </div>
  )
}
