"use client"

import { useState } from "react"
import { Mail, Loader2, X, Check, AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"

const inputCls = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"

/**
 * Send an invoice, quote or delivery note to its client with the PDF attached.
 *
 * The address is prefilled from the client record but stays editable, because
 * the one on file is often a billing inbox and the sender may want a person
 * instead. Nothing is sent until they confirm — this is outward-facing mail.
 */
export function SendEmailButton({ kind, id, defaultTo, className }: {
  kind: "invoice" | "quote"
  id: string
  defaultTo?: string | null
  className?: string
}) {
  const t = useTranslations("email")
  const tCommon = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(defaultTo ?? "")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openDialog = () => {
    setTo(defaultTo ?? ""); setMessage(""); setError(null); setSent(null); setOpen(true)
  }

  const send = async () => {
    setSending(true); setError(null)
    try {
      const res = await fetch("/api/documents/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, to: to.trim() || undefined, message: message.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.detail ?? json.error ?? t("failed")); setSending(false); return }
      setSent(json.to ?? to)
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={openDialog}
        className={className ?? "flex items-center gap-2 px-3 py-2 text-sm font-medium bg-card border border-border rounded-xl hover:bg-muted transition-colors"}
      >
        <Mail className="w-4 h-4" /> {t("send")}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !sending && setOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
              <button onClick={() => !sending && setOpen(false)} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {sent ? (
              <div className="text-center py-4">
                <div className="w-11 h-11 rounded-full bg-[var(--status-paid)]/10 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-5 h-5 text-[var(--status-paid)]" />
                </div>
                <p className="text-sm text-foreground font-medium mb-1">{t("sentTitle")}</p>
                <p className="text-xs text-muted-foreground break-all">{sent}</p>
                <button onClick={() => setOpen(false)} className="mt-5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
                  {tCommon("close")}
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{t("to")} <span className="text-destructive">*</span></label>
                    <input
                      autoFocus type="email" value={to} onChange={e => setTo(e.target.value)}
                      placeholder="cliente@empresa.com" className={inputCls}
                    />
                    {!defaultTo && <p className="text-[11px] text-muted-foreground mt-1">{t("noStoredEmail")}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{t("message")}</label>
                    <textarea
                      value={message} onChange={e => setMessage(e.target.value)} rows={3}
                      placeholder={t("messagePlaceholder")} className={inputCls}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t("attachmentNote")}</p>
                  {error && (
                    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-destructive text-sm">{error}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 mt-5">
                  <button onClick={() => !sending && setOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    {tCommon("cancel")}
                  </button>
                  <button
                    onClick={send} disabled={sending || !to.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {t("send")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
