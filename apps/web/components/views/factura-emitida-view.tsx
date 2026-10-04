"use client"

import { useTaxAuthorityMode } from "@/lib/hooks/use-tax-authority-mode"
import { useEffect, useState } from "react"
import useSWR from "swr"
import QRCode from "qrcode"
import { ArrowLeft, Printer, ShieldCheck, Loader2, Ban, Copy, Check, Wallet, Info } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useOrganization } from "@/lib/context/organization-context"
import { isPaidPlan } from "@/lib/plan"
import { cn } from "@/lib/utils"
import { SendEmailButton } from "@/components/send-email-button"
import { DocumentChain, useChain } from "@/components/document-chain"
import type { Database } from "@/lib/supabase/types"
import { formatMoney, needsExchangeRate, toEur } from "@/lib/currency"
import { PAYMENT_METHODS, isPaymentMethod } from "@/lib/payment-methods"

type Invoice = Database["public"]["Tables"]["invoices"]["Row"]
type Line = Database["public"]["Tables"]["invoice_lines"]["Row"]

type RectifiedBy = { id: string; full_number: string | null } | null

async function fetchInvoice(id: string): Promise<{ invoice: Invoice; lines: Line[]; rectifiedBy: RectifiedBy; clientEmail: string | null } | null> {
  const supabase = createClient()
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", id).single()
  if (error || !invoice) return null
  const { data: lines } = await supabase.from("invoice_lines").select("*").eq("invoice_id", id).order("position")
  // The credit note that annuls this invoice, if one was already issued.
  const { data: rectifiedBy } = await supabase
    .from("invoices").select("id, full_number").eq("rectifies_invoice_id", id).maybeSingle()
  // The invoice snapshots the client's name and CIF but not their email, so
  // the address to send it to comes from the client record.
  const { data: client } = await supabase
    .from("companies").select("email").eq("id", invoice.client_company_id).maybeSingle()
  return {
    invoice: invoice as Invoice, lines: (lines ?? []) as Line[],
    rectifiedBy: rectifiedBy ?? null, clientEmail: client?.email ?? null,
  }
}

export function FacturaEmitidaView({ id }: { id: string }) {
  const t = useTranslations("invoicing")
  const tPayment = useTranslations("documents.paymentMethods")
  const locale = useLocale()
  const router = useRouter()
  const { currentOrg, isOrgAdmin } = useOrganization()
  const { data, isLoading, mutate } = useSWR(["invoice", id], () => fetchInvoice(id), { revalidateOnFocus: false })
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [rectifying, setRectifying] = useState(false)
  const [huellaCopied, setHuellaCopied] = useState(false)
  // Just issued (?nueva=1): say so, and put sending it by email right there,
  // since that is the step that finishes the job (WEB-014).
  const [justIssued, setJustIssued] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("nueva") !== "1") return
    setJustIssued(true)
    window.history.replaceState(null, "", window.location.pathname)
  }, [])

  const copyHuella = () => {
    if (!invoice?.huella) return
    navigator.clipboard.writeText(invoice.huella)
    setHuellaCopied(true)
    setTimeout(() => setHuellaCopied(false), 2000)
  }

  const invoice = data?.invoice
  const chain = useChain({ kind: "invoice", id })
  const lines = data?.lines ?? []
  const rectifiedBy = data?.rectifiedBy ?? null

  // Once annulled it cannot be annulled again — the server refuses it, so
  // offering the button only produces an error.
  // The tax authority access mode only consults (RD 1007/2023 art. 8.4).
  const taxMode = useTaxAuthorityMode()
  const canRectify = invoice?.state === "issued" && invoice?.kind !== "rectifying"
    && !rectifiedBy && isOrgAdmin && isPaidPlan(currentOrg) && !taxMode

  const handleRectify = async () => {
    if (!invoice || !currentOrg || !confirm(t("rectifyConfirm"))) return
    setRectifying(true)
    try {
      const res = await fetch("/api/invoices/rectify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrg.id, invoiceId: invoice.id }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error === "already_rectified" ? t("alreadyRectified") : t("rectifyError")); setRectifying(false); return }
      await mutate()
      router.push(`/facturacion/${json.id}`)
    } catch {
      setRectifying(false); alert(t("rectifyError"))
    }
  }

  useEffect(() => {
    if (invoice?.qr_url) {
      QRCode.toDataURL(invoice.qr_url, { width: 160, margin: 1 }).then(setQrSrc).catch(() => setQrSrc(null))
    }
  }, [invoice?.qr_url])

  // ── Cobro ──
  // Payment method and date are not part of the Verifactu record, and
  // protect_issued_invoice does not freeze them: recording that an invoice
  // was paid does not alter it.
  const [payMethod, setPayMethod] = useState("")
  const [payDate, setPayDate] = useState("")
  const [paySaving, setPaySaving] = useState(false)
  const [payMsg, setPayMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => {
    if (!invoice) return
    setPayMethod(invoice.payment_method ?? "")
    setPayDate(invoice.payment_date ?? "")
  }, [invoice?.id, invoice?.payment_method, invoice?.payment_date])

  const canEditPayment = isOrgAdmin && invoice?.state !== "draft" && !taxMode
  const payDirty = !!invoice && (payMethod !== (invoice.payment_method ?? "") || payDate !== (invoice.payment_date ?? ""))

  const savePayment = async (override?: { date: string }) => {
    if (!invoice) return
    const date = override ? override.date : payDate
    setPaySaving(true); setPayMsg(null)
    const supabase: any = createClient()
    const patch: Record<string, unknown> = {
      payment_method: payMethod || null,
      payment_date: date || null,
    }
    // An annulled invoice keeps its 'cancelled' status whatever is recorded.
    if (invoice.payment_status !== "cancelled") patch.payment_status = date ? "paid" : "pending"
    const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id)
    setPaySaving(false)
    if (error) { setPayMsg({ ok: false, text: `${t("paymentSaveError")}: ${error.message}` }); return }
    // Keep the library copy in step: the dashboard and Biblioteca total
    // "cobrado / pendiente" from documents.status, not from the invoice.
    if (invoice.document_id && patch.payment_status) {
      await supabase.from("documents").update({
        status: patch.payment_status, payment_date: date || null, payment_method: payMethod || null,
      }).eq("id", invoice.document_id)
    }
    toast.success(t("paymentSaved"))
    if (override) setPayDate(override.date)
    setPayMsg({ ok: true, text: t("paymentSaved") })
    await mutate()
  }

  const fmtEur = (n: number) => formatMoney(Number(n) || 0, invoice?.currency ?? "EUR")

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  if (!invoice) return <div className="p-8 text-sm text-muted-foreground">{t("notFound")}</div>

  return (
    <div className="p-6 sm:p-8 print:p-12 max-w-3xl mx-auto">
      {/* Toolbar (hidden on print) */}
      <div className="flex items-start justify-between gap-4 mb-6 print:hidden">
        <Link href="/facturacion" className="flex items-center gap-1.5 shrink-0 mt-2 text-sm text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("backToList")}
        </Link>
        {/* Wraps between buttons rather than inside their labels. */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canRectify && (
            <button onClick={handleRectify} disabled={rectifying} className="flex items-center gap-2 px-4 py-2 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted disabled:opacity-50 whitespace-nowrap transition-colors">
              {rectifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} {t("rectify")}
            </button>
          )}
          {!taxMode && <SendEmailButton kind="invoice" id={id} defaultTo={data?.clientEmail} onSent={() => { void mutate() }} />}
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 whitespace-nowrap transition-colors">
            <Printer className="w-4 h-4" /> {t("print")}
          </button>
        </div>
      </div>

      {justIssued && (
        <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3 bg-[var(--status-paid)]/8 border border-[var(--status-paid)]/25 rounded-xl print:hidden">
          <Check className="w-4 h-4 text-[var(--status-paid)] shrink-0" />
          <p className="text-sm text-foreground flex-1 min-w-0">{t("issuedBanner", { number: invoice.full_number ?? "" })}</p>
          <SendEmailButton kind="invoice" id={id} defaultTo={data?.clientEmail} onSent={() => { setJustIssued(false); void mutate() }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 whitespace-nowrap transition-colors" />
        </div>
      )}

      {!taxMode && <DocumentChain chain={chain} current="invoice" />}

      {/* Rectificative banner */}
      {invoice.kind === "rectifying" && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-[var(--status-overdue)]/8 border border-[var(--status-overdue)]/20 rounded-xl print:hidden">
          <Ban className="w-4 h-4 text-[var(--status-overdue)] shrink-0" />
          <p className="text-sm text-foreground">{t("rectificativeBanner")}</p>
        </div>
      )}

      {rectifiedBy && (
        <button
          onClick={() => router.push(`/facturacion/${rectifiedBy.id}`)}
          className="mb-4 w-full flex items-center gap-2 px-4 py-2.5 bg-[var(--status-overdue)]/8 border border-[var(--status-overdue)]/20 rounded-xl print:hidden text-left hover:bg-[var(--status-overdue)]/12 transition-colors"
        >
          <Ban className="w-4 h-4 text-[var(--status-overdue)] shrink-0" />
          <p className="text-sm text-foreground flex-1">{t("rectifiedBanner", { number: rectifiedBy.full_number ?? "" })}</p>
        </button>
      )}

      {/* Invoice document */}
      <div className="bg-card border border-border rounded-2xl p-8 print:border-0 print:shadow-none">
        {/* Header: issuer + invoice meta */}
        <div className="flex justify-between items-start gap-6 mb-8">
          <div className="flex items-start gap-3">
            {invoice.issuer_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invoice.issuer_logo_url} alt="" className="w-12 h-12 object-contain rounded-lg border border-border shrink-0" />
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground">{invoice.issuer_name ?? "—"}</h1>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {invoice.issuer_cif && <p>CIF: {invoice.issuer_cif}</p>}
                {invoice.issuer_address && <p>{invoice.issuer_address}</p>}
                <p>{[invoice.issuer_postal_code, invoice.issuer_city, invoice.issuer_province].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">{t("invoice")}</p>
            <p className="text-lg font-bold text-foreground">{invoice.full_number}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("issueDate")}: {invoice.issue_date}</p>
            {invoice.sent_at && (
              <p className="text-xs text-primary font-medium print:hidden">
                {t("sentOn", { to: invoice.sent_to ?? "", date: new Date(invoice.sent_at).toLocaleDateString(locale) })}
              </p>
            )}
            {invoice.due_date && <p className="text-xs text-muted-foreground">{t("dueDate")}: {invoice.due_date}</p>}
          </div>
        </div>

        {/* Client */}
        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 mb-1">{t("billTo")}</p>
          <p className="text-sm font-semibold text-foreground">{invoice.client_name ?? "—"}</p>
          <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
            {invoice.client_cif && <p>CIF: {invoice.client_cif}</p>}
            {invoice.client_address && <p>{invoice.client_address}</p>}
            <p>{[invoice.client_postal_code, invoice.client_city, invoice.client_province].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        {/* Lines */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground/70">
              <th className="py-2 font-semibold">{t("description")}</th>
              <th className="py-2 font-semibold text-right">{t("qty")}</th>
              <th className="py-2 font-semibold text-right">{t("unitPrice")}</th>
              <th className="py-2 font-semibold text-right">{t("tax")}%</th>
              <th className="py-2 font-semibold text-right">{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.id} className="border-b border-border/50">
                <td className="py-2 text-foreground">{l.description}</td>
                <td className="py-2 text-right text-muted-foreground">{Number(l.quantity)}</td>
                <td className="py-2 text-right text-muted-foreground">{fmtEur(l.unit_price)}</td>
                <td className="py-2 text-right text-muted-foreground">{Number(l.tax_rate)}%</td>
                <td className="py-2 text-right font-medium text-foreground">{fmtEur(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>{t("subtotal")}</span><span>{fmtEur(invoice.subtotal)}</span></div>
            {Number((invoice as any).discount_amount) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>{t("discount")} ({Number((invoice as any).discount_pct) || 0}%)</span><span>−{fmtEur(Number((invoice as any).discount_amount))}</span></div>
            )}
            <div className="flex justify-between text-muted-foreground"><span>{t("tax")}</span><span>{fmtEur(invoice.tax_amount)}</span></div>
            {Number(invoice.retention_amount) !== 0 && (
              <div className="flex justify-between text-muted-foreground"><span>{t("retention")} ({Number(invoice.retention_pct) || 0}%)</span><span>−{fmtEur(invoice.retention_amount)}</span></div>
            )}
            <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-1"><span>{t("total")}</span><span>{fmtEur(invoice.total)}</span></div>
            {needsExchangeRate(invoice.currency) && (invoice as any).exchange_rate != null && (
              <p className="text-[11px] text-muted-foreground pt-1 text-right">
                1 {invoice.currency} = {Number((invoice as any).exchange_rate).toFixed(4).replace(".", ",")} € · {formatMoney(toEur(Number(invoice.total), invoice.currency, (invoice as any).exchange_rate), "EUR")}
              </p>
            )}
          </div>
        </div>

        {isPaymentMethod(invoice.payment_method) && (
          <p className="text-xs text-foreground mb-2"><span className="font-semibold">{t("paymentMethod")}:</span> {tPayment(invoice.payment_method)}</p>
        )}
        {invoice.notes && <p className="text-xs text-muted-foreground mb-8 whitespace-pre-wrap">{invoice.notes}</p>}

        {/* Verifactu block. Solo si la factura lleva registro: sin huella no
            hay nada que cotejar y la leyenda sería falsa. */}
        {invoice.huella && (
        <div className="flex items-end justify-between gap-4 border-t border-border pt-5">
          <div className="flex items-start gap-1.5 min-w-0">
            <ShieldCheck className="w-4 h-4 text-[var(--status-paid)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground tracking-wide">VERI*FACTU</p>
              <p className="text-[9px] text-muted-foreground">{t("verifactuFooter")}</p>
              {/* Plain-language explanation of the seal; the terms mean
                  nothing to most readers (WEB-015). Screen only. */}
              <details className="mt-1 print:hidden group/vf">
                <summary className="flex items-center gap-1 text-[10px] font-medium text-accent cursor-pointer list-none hover:underline">
                  <Info className="w-3 h-3" /> {t("verifactuWhat")}
                </summary>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground max-w-md">{t("verifactuExplain")}</p>
              </details>
              {/* Whether the record actually reached the AEAT. The legend above
                  claims the invoice is verifiable there, and until the record
                  has been accepted it is not — so the state is said plainly. */}
              <p className={cn(
                "text-[9px] font-semibold mt-0.5 print:hidden",
                invoice.verifactu_status === "sent" ? "text-[var(--status-paid)]"
                  : invoice.verifactu_status === "error" ? "text-[var(--status-overdue)]"
                  : "text-[var(--status-pending)]",
              )}>
                {invoice.verifactu_status === "sent"
                  ? `${t("aeatSent")}${invoice.aeat_csv ? ` · CSV ${invoice.aeat_csv}` : ""}`
                  : invoice.verifactu_status === "error"
                    ? `${t("aeatError")}${invoice.aeat_error ? `: ${invoice.aeat_error}` : ""}`
                    : t("aeatPending")}
              </p>
              {invoice.huella && (
                <div className="flex items-center gap-1.5 mt-0.5 print:gap-0">
                  <p className="text-[8px] text-muted-foreground/60 font-mono break-all max-w-[320px]">{t("fingerprint")}: {invoice.huella}</p>
                  <button
                    type="button"
                    onClick={copyHuella}
                    className="shrink-0 p-1 rounded hover:bg-muted transition-colors print:hidden"
                    aria-label={t("copyFingerprint")}
                    title={t("copyFingerprint")}
                  >
                    {huellaCopied ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                  </button>
                </div>
              )}
            </div>
          </div>
          {qrSrc && <img src={qrSrc} alt="QR Verifactu" className="w-24 h-24 shrink-0" />}
        </div>
        )}
      </div>

      {/* Cobro — not part of the printed invoice */}
      {invoice.state !== "draft" && (
        <div className="mt-4 bg-card border border-border rounded-2xl p-5 print:hidden">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">{t("payment")}</h2>
            </div>
            <span className={cn(
              "text-[11px] px-2 py-0.5 rounded-full font-medium",
              invoice.payment_date
                ? "bg-[var(--status-paid)]/10 text-[var(--status-paid)]"
                : "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
            )}>
              {invoice.payment_date ? t("paid") : t("unpaid")}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("paymentMethod")}</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} disabled={!canEditPayment}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70">
                <option value="">{tPayment("none")}</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{tPayment(m)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("paymentDate")}</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} disabled={!canEditPayment}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70" />
            </div>
          </div>
          {canEditPayment && (
            <div className="flex flex-wrap items-center justify-end gap-2 mt-4">
              {payMsg && <p className={cn("text-xs mr-auto", payMsg.ok ? "text-[var(--status-paid)]" : "text-destructive")}>{payMsg.text}</p>}
              {invoice.payment_date ? (
                <button onClick={() => savePayment({ date: "" })} disabled={paySaving}
                  className="px-3 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted disabled:opacity-50 transition-colors">
                  {t("markUnpaid")}
                </button>
              ) : (
                <button onClick={() => savePayment({ date: payDate || new Date().toISOString().slice(0, 10) })} disabled={paySaving}
                  className="px-3 py-2 text-sm font-medium border border-border rounded-xl hover:bg-muted disabled:opacity-50 transition-colors">
                  {t("markPaid")}
                </button>
              )}
              <button onClick={() => savePayment()} disabled={paySaving || !payDirty}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {paySaving && <Loader2 className="w-4 h-4 animate-spin" />} {t("savePayment")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
