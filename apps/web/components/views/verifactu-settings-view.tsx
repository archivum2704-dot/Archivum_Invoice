"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, Upload, Trash2, Loader2, AlertTriangle, CheckCircle2, Lock, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { isPaidPlan } from "@/lib/plan"

type CertStatus = { exists: boolean; subject?: string; nif?: string; valid_until?: string; uploaded_at?: string }

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer())
  let bin = ""
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function VerifactuSettingsView() {
  const t = useTranslations("verifactu")
  const locale = useLocale()
  const { currentOrg, isOrgAdmin, isPlatformAdmin } = useOrganization()
  const allowed = isOrgAdmin && (isPaidPlan(currentOrg) || isPlatformAdmin)

  const [status, setStatus] = useState<CertStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const loadStatus = async () => {
    if (!currentOrg) return
    setLoading(true)
    try {
      const res = await fetch(`/api/verifactu/certificate?orgId=${currentOrg.id}`)
      setStatus(res.ok ? await res.json() : { exists: false })
    } catch { setStatus({ exists: false }) }
    setLoading(false)
  }

  useEffect(() => { if (allowed) loadStatus() }, [currentOrg?.id, allowed])

  const handleUpload = async () => {
    if (!file || !currentOrg) return
    setSaving(true); setError(null); setOk(null)
    try {
      const certBase64 = await fileToBase64(file)
      const res = await fetch("/api/verifactu/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrg.id, certBase64, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        const map: Record<string, string> = {
          invalid_certificate: t("errors.invalid"),
          vault_not_configured: t("errors.vault"),
          forbidden: t("errors.forbidden"),
        }
        setError(map[json.error] ?? json.detail ?? t("errors.generic"))
      } else {
        setOk(t("uploaded")); setFile(null); setPassword(""); await loadStatus()
      }
    } catch (e) { setError(String(e)) }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!currentOrg || !confirm(t("deleteConfirm"))) return
    await fetch(`/api/verifactu/certificate?orgId=${currentOrg.id}`, { method: "DELETE" })
    await loadStatus()
  }

  if (!allowed) {
    return (
      <div className="p-6 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <Lock className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t("notAllowed")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      <Link href="/facturacion" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("back")}
      </Link>

      <div className="flex items-center gap-2.5 mb-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">{t("subtitle")}</p>

      {/* Current status */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">{t("currentCert")}</h2>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : status?.exists ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-[var(--status-paid)]">
              <CheckCircle2 className="w-4 h-4" /> {t("installed")}
            </div>
            <dl className="text-xs text-muted-foreground space-y-1">
              {status.nif && <div><span className="font-medium text-foreground">NIF:</span> {status.nif}</div>}
              {status.subject && <div className="break-all"><span className="font-medium text-foreground">{t("subject")}:</span> {status.subject}</div>}
              {status.valid_until && <div><span className="font-medium text-foreground">{t("validUntil")}:</span> {new Date(status.valid_until).toLocaleDateString(locale)}</div>}
            </dl>
            <button onClick={handleDelete} className="mt-2 flex items-center gap-1.5 text-xs text-destructive hover:underline">
              <Trash2 className="w-3.5 h-3.5" /> {t("remove")}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noCert")}</p>
        )}
      </div>

      {/* Upload form */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">{status?.exists ? t("replaceCert") : t("uploadCert")}</h2>
        <p className="text-xs text-muted-foreground mb-4">{t("uploadHint")}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("certFile")}</label>
            <input
              type="file"
              accept=".p12,.pfx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("certPassword")}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
          {ok && (
            <div className="flex items-center gap-2 bg-[var(--status-paid)]/10 border border-[var(--status-paid)]/20 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 text-[var(--status-paid)]" />
              <p className="text-[var(--status-paid)] text-sm">{ok}</p>
            </div>
          )}

          <button onClick={handleUpload} disabled={saving || !file || !password} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {t("save")}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">{t("securityNote")}</p>
    </div>
  )
}
