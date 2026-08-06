"use client"

import { useState } from "react"
import { X, Plus, Loader2, AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"

const EMPTY = { name: "", cif: "", email: "", phone: "", address: "", postal_code: "", city: "", province: "" }

const inputCls = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"

/**
 * Create a client without leaving the invoice or quote being written.
 *
 * Invoicing and quoting each had their own copy of this form, and they drifted:
 * neither captured the email, so a document could be issued to a client there
 * was no way to send it to. One component now serves both, and it asks for
 * everything a Spanish invoice has to print — the address is not optional on
 * one.
 */
export function NewClientModal({ orgId, onCreated, onClose }: {
  orgId: string
  /** Receives the new client's id so the caller can select it. */
  onCreated: (id: string) => Promise<void> | void
  onClose: () => void
}) {
  const t = useTranslations("invoicing")
  const tCommon = useTranslations("common")
  const [nc, setNc] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => { if (!saving) onClose() }

  const handleCreate = async () => {
    if (!nc.name.trim() || !orgId) return
    setSaving(true); setError(null)
    const supabase: any = createClient()
    const { data, error: err } = await supabase.from("companies").insert({
      organization_id: orgId,
      name: nc.name.trim(),
      cif: nc.cif.trim() || null,
      email: nc.email.trim() || null,
      phone: nc.phone.trim() || null,
      address: nc.address.trim() || null,
      postal_code: nc.postal_code.trim() || null,
      city: nc.city.trim() || null,
      province: nc.province.trim() || null,
      is_active: true,
    }).select("id").single()

    // The plan-limit trigger raises its own Spanish message, so it is worth
    // showing verbatim rather than replacing it with something generic.
    if (err || !data) { setError(err?.message ?? t("createClientError")); setSaving(false); return }

    await onCreated(data.id)
    setSaving(false)
    setNc(EMPTY)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">{t("newClient")}</h2>
          <button onClick={close} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("clientName")} <span className="text-destructive">*</span></label>
            <input autoFocus value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">CIF</label>
            <input value={nc.cif} onChange={e => setNc({ ...nc, cif: e.target.value })} placeholder="B12345678" className={inputCls} />
            <p className="text-[11px] text-muted-foreground mt-1">{t("clientCifHint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("clientEmail")}</label>
              <input type="email" value={nc.email} onChange={e => setNc({ ...nc, email: e.target.value })} placeholder="cliente@empresa.com" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("clientPhone")}</label>
              <input value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} className={inputCls} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">{t("clientEmailHint")}</p>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("clientAddress")}</label>
            <input value={nc.address} onChange={e => setNc({ ...nc, address: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">{t("clientPostalCode")}</label>
              <input value={nc.postal_code} onChange={e => setNc({ ...nc, postal_code: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">{t("clientCity")}</label>
              <input value={nc.city} onChange={e => setNc({ ...nc, city: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">{t("clientProvince")}</label>
              <input value={nc.province} onChange={e => setNc({ ...nc, province: e.target.value })} className={inputCls} />
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={close} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">{tCommon("cancel")}</button>
          <button onClick={handleCreate} disabled={saving || !nc.name.trim()} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t("createClient")}
          </button>
        </div>
      </div>
    </div>
  )
}
