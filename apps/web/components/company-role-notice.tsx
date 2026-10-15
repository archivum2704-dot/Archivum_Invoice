"use client"

import { useState } from "react"
import { Info, Loader2, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { withRole, type CompanyRole } from "@/lib/company-kind"
import { explainCompanyError, type ClientLike } from "@/lib/client-checks"
import { toast } from "sonner"

/**
 * The CIF/NIF typed is already on file, but as the other role (a client when
 * adding a supplier, or the reverse). It is the same taxpayer, and the CIF is
 * unique per organization, so instead of a second record the existing one
 * gains the role (kind 'both').
 */
export function CompanyRoleNotice({ company, role, onAdded }: {
  company: ClientLike
  role: CompanyRole
  /** Called with the company's id once it has the role. */
  onAdded: (id: string) => Promise<void> | void
}) {
  const t = useTranslations(role === "supplier" ? "suppliers" : "companies")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async () => {
    setBusy(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from("companies")
      .update({ kind: withRole(company, role) }).eq("id", company.id)
    if (err) { setBusy(false); setError(explainCompanyError(err, t("addRoleExisting", { name: company.name }))); return }
    toast.success(t("addedRoleToast", { name: company.name }))
    await onAdded(company.id)
    setBusy(false)
  }

  return (
    <div className="text-xs text-foreground bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-2 space-y-2">
      <p className="flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px text-primary" /> {t("existsWithOtherRole", { name: company.name })}</p>
      <button type="button" onClick={add} disabled={busy}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border font-medium hover:bg-muted disabled:opacity-60 transition-colors">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        {t("addRoleExisting", { name: company.name })}
      </button>
      {error && <p className="text-destructive">{error}</p>}
    </div>
  )
}
