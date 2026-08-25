"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowLeft, ShieldCheck, ShieldOff, Loader2, KeyRound, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Factor = { id: string; friendly_name?: string | null; status: "verified" | "unverified"; created_at: string }

/** account-wide two-factor auth (TOTP) — Supabase Auth's own MFA, not a
 * home-rolled implementation. Enroll/challenge/verify all go through
 * supabase.auth.mfa.*; the factor itself lives in Supabase's auth schema,
 * nothing to store on our side. */
export function SecuritySettingsView() {
  const t = useTranslations("mfa.settings")

  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Enrollment flow state
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [justEnabled, setJustEnabled] = useState(false)

  const loadFactors = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error: err } = await supabase.auth.mfa.listFactors()
    if (!err) setFactors((data?.totp ?? []) as Factor[])
    setLoading(false)
  }

  useEffect(() => { loadFactors() }, [])

  const verifiedFactor = factors.find(f => f.status === "verified")

  const startEnroll = async () => {
    setError(null); setEnrolling(true); setJustEnabled(false)
    const supabase = createClient()
    // Only one unverified TOTP factor is allowed at a time — drop any
    // abandoned attempt from a previous visit before starting a fresh one.
    const stale = factors.find(f => f.status === "unverified")
    if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id })

    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp" })
    if (err || !data) {
      setError(err?.message ?? t("errors.enroll"))
      setEnrolling(false)
      return
    }
    setPendingFactorId(data.id)
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
  }

  const cancelEnroll = async () => {
    if (pendingFactorId) {
      const supabase = createClient()
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId })
    }
    setEnrolling(false); setQrCode(null); setSecret(null); setPendingFactorId(null); setCode(""); setError(null)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingFactorId || code.length !== 6) return
    setVerifying(true); setError(null)
    const supabase = createClient()
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId })
    if (challengeErr || !challenge) { setError(t("errors.invalidCode")); setVerifying(false); return }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId, challengeId: challenge.id, code,
    })
    setVerifying(false)
    if (verifyErr) { setError(t("errors.invalidCode")); setCode(""); return }
    setEnrolling(false); setQrCode(null); setSecret(null); setPendingFactorId(null); setCode("")
    setJustEnabled(true)
    await loadFactors()
  }

  const handleRemove = async (factorId: string) => {
    if (!confirm(t("confirmRemove"))) return
    setRemovingId(factorId); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId })
    setRemovingId(null)
    if (err) { setError(err.message); return }
    setJustEnabled(false)
    await loadFactors()
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      <Link href="/configuracion" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("back")}
      </Link>

      <div className="flex items-center gap-2.5 mb-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">{t("subtitle")}</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : verifiedFactor && !enrolling ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-accent/5 border border-accent/20 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t("enabled")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("enabledSince", { date: new Date(verifiedFactor.created_at).toLocaleDateString() })}</p>
            </div>
          </div>

          {justEnabled && (
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
              <p className="text-xs text-foreground/80 leading-relaxed">{t("justEnabledHint")}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleRemove(verifiedFactor.id)}
            disabled={removingId === verifiedFactor.id}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive border border-destructive/40 rounded-lg hover:bg-destructive/10 disabled:opacity-50 transition-colors"
          >
            {removingId === verifiedFactor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
            {t("disable")}
          </button>
        </div>
      ) : enrolling ? (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <p className="text-sm text-foreground">{t("scanInstructions")}</p>
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="QR" className="w-44 h-44 rounded-lg border border-border" />
              </div>
            )}
            {secret && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{t("manualEntry")}</p>
                <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded-lg tracking-wider">{secret}</code>
              </div>
            )}
          </div>

          <form onSubmit={handleVerify} className="space-y-3">
            <label className="block text-sm font-medium text-foreground">{t("enterCode")}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={verifying}
              className="w-full px-3 py-3 text-center text-2xl tracking-[0.5em] font-mono bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {t("confirmEnable")}
              </button>
              <button
                type="button"
                onClick={cancelEnroll}
                disabled={verifying}
                className="py-2.5 px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl p-4">
            <ShieldOff className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t("disabled")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("disabledHint")}</p>
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button
            type="button"
            onClick={startEnroll}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            {t("enable")}
          </button>
        </div>
      )}
    </div>
  )
}
