"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ACCOUNT_DELETION_CONFIRM_WORD, explainAccountDeletionError } from "@/lib/account-deletion"

export function DeleteAccountForm({ email }: { email: string }) {
  const [word, setWord] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const ready = word.trim().toUpperCase() === ACCOUNT_DELETION_CONFIRM_WORD

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: word }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(explainAccountDeletionError(data.error, data.organizations))
        return
      }
      // The user no longer exists; drop the local session cookies too.
      await createClient().auth.signOut().catch(() => {})
      setDone(true)
    } catch {
      setError(explainAccountDeletionError(undefined))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="bg-card border border-border rounded-xl px-4 py-4 text-sm text-foreground">
        <p className="font-semibold">Tu cuenta se ha eliminado.</p>
        <p className="mt-1 text-muted-foreground">Te hemos enviado una confirmación por correo.</p>
      </div>
    )
  }

  return (
    <div className="border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 rounded-xl px-4 py-4">
      <p className="text-sm font-semibold text-foreground">Eliminar la cuenta {email}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        No se puede deshacer. Escribe <strong className="text-foreground">{ACCOUNT_DELETION_CONFIRM_WORD}</strong> para confirmar.
      </p>
      <input
        value={word}
        onChange={e => setWord(e.target.value)}
        autoComplete="off"
        aria-label={`Escribe ${ACCOUNT_DELETION_CONFIRM_WORD} para confirmar`}
        className="mt-3 w-full max-w-xs rounded-xl border border-input bg-background px-3 py-2 text-sm"
      />
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={handleDelete}
        disabled={!ready || busy}
        className="mt-3 block px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {busy ? "Eliminando…" : "Eliminar mi cuenta definitivamente"}
      </button>
    </div>
  )
}
