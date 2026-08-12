"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Printer, Download, Pencil, ArrowRight, Loader2, ClipboardList } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { fetchQuoteWithLines, type Quote, type QuoteLine } from "@/lib/hooks/use-quotes"
import { createClient } from "@/lib/supabase/client"
import { SendEmailButton } from "@/components/send-email-button"
import { formatMoney, needsExchangeRate, toEur } from "@/lib/currency"

// Toolbar buttons. whitespace-nowrap is the point: the row wraps between
// buttons, never inside a label.
const SECONDARY = "flex items-center gap-2 px-3 py-2 text-sm font-medium bg-card border border-border rounded-xl hover:bg-muted whitespace-nowrap transition-colors"
const PRIMARY = "flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap transition-colors"

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", sent: "Enviado", accepted: "Aceptado", rejected: "Rechazado",
  open: "Abierto", converted: "Facturado",
}
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", sent: "bg-primary/10 text-primary",
  accepted: "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  rejected: "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
  open: "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  converted: "bg-accent/10 text-accent",
}

export function PresupuestoDetalleView({ id }: { id: string }) {
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [lines, setLines] = useState<QuoteLine[]>([])
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [opening, setOpening] = useState(false)
  // A quote points at the delivery note opened for it; a note points back at
  // its quote. The screen is shared, so it has to know which it is showing.
  const [related, setRelated] = useState<{ id: string; full_number: string | null } | null>(null)
  // Quotes snapshot the client's name but not their email, so the address to
  // send to comes from the client record.
  const [clientEmail, setClientEmail] = useState<string | null>(null)

  const isNote = quote?.kind === "delivery_note"

  useEffect(() => {
    fetchQuoteWithLines(id).then(async data => {
      if (data) {
        setQuote(data.quote); setLines(data.lines)
        const supabase: any = createClient()
        const { data: rel } = data.quote.kind === "delivery_note"
          ? await supabase.from("quotes").select("id, full_number").eq("id", data.quote.source_quote_id).maybeSingle()
          : await supabase.from("quotes").select("id, full_number").eq("source_quote_id", data.quote.id).maybeSingle()
        setRelated(rel ?? null)
        if (data.quote.client_company_id) {
          const { data: c } = await supabase
            .from("companies").select("email").eq("id", data.quote.client_company_id).maybeSingle()
          setClientEmail(c?.email ?? null)
        }
      }
      setLoading(false)
    })
  }, [id])

  const handleConvert = async () => {
    if (!quote) return
    if (!confirm(`¿Emitir la factura del albarán ${quote.full_number ?? ""}? Se emitirá con Verifactu y no podrá deshacerse.`)) return
    setConverting(true)
    const res = await fetch("/api/quotes/convert", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: quote.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { alert(json.detail ?? json.error ?? "No se pudo emitir la factura."); setConverting(false); return }
    router.push(`/facturacion/${json.invoiceId}`)
  }

  // Quotes finalized before albaranes existed have no note. Opening one here is
  // the only way those reach an invoice, since billing runs off the note.
  const handleOpenNote = async () => {
    if (!quote) return
    setOpening(true)
    const res = await fetch("/api/quotes/delivery-note", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: quote.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { alert(json.detail ?? json.error ?? "No se pudo abrir el albarán."); setOpening(false); return }
    router.push(`/presupuestos/${json.id}`)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
  if (!quote) return (
    <div className="p-8 text-center">
      <p className="text-sm text-muted-foreground mb-3">Documento no encontrado.</p>
      <Link href="/presupuestos" className="text-sm text-primary hover:underline">Volver</Link>
    </div>
  )

  const fmtEur = (n: number) => formatMoney(Number(n) || 0, quote.currency)

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      {/* Toolbar (hidden on print).
          Five actions do not fit on one line at this width, so the group wraps
          instead of squeezing: without nowrap the labels broke inside the
          buttons ("Enviar / por / correo") and the row looked broken. */}
      <div className="flex items-start justify-between gap-4 mb-6 print:hidden">
        <Link href={isNote ? "/albaranes" : "/presupuestos"} className="flex items-center gap-1.5 shrink-0 mt-2 text-sm text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors">
          <ArrowLeft className="w-4 h-4" /> {isNote ? "Albaranes" : "Pedidos"}
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <a href={`/api/quotes/pdf?id=${quote.id}`} className={SECONDARY}>
            <Download className="w-4 h-4" /> Descargar
          </a>
          <button onClick={() => window.print()} className={SECONDARY}>
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <SendEmailButton kind="quote" id={quote.id} defaultTo={clientEmail} compact className={SECONDARY} />
          {/* Only a quote is editable, and only a delivery note is billed. */}
          {!isNote && quote.status !== "converted" && (
            <Link href={`/presupuestos?edit=${quote.id}`} className={SECONDARY}>
              <Pencil className="w-4 h-4" /> Editar
            </Link>
          )}
          {!isNote && related && (
            <Link href={`/presupuestos/${related.id}`} className={PRIMARY}>
              <ArrowRight className="w-4 h-4" /> Albarán {related.full_number ?? ""}
            </Link>
          )}
          {!isNote && !related && quote.status !== "converted" && (
            <button onClick={handleOpenNote} disabled={opening} className={PRIMARY}>
              {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />} Abrir albarán
            </button>
          )}
          {isNote && quote.status !== "converted" && (
            <button onClick={handleConvert} disabled={converting} className={PRIMARY}>
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Emitir factura
            </button>
          )}
          {quote.status === "converted" && quote.converted_invoice_id && (
            <Link href={`/facturacion/${quote.converted_invoice_id}`} className={cn(PRIMARY, "bg-accent text-accent-foreground hover:bg-accent/90")}>
              Ver factura
            </Link>
          )}
        </div>
      </div>

      {/* Quote card */}
      <div className="bg-card border border-border rounded-2xl p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            {quote.issuer_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={quote.issuer_logo_url} alt="" className="w-12 h-12 object-contain rounded-lg border border-border shrink-0" />
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground">{quote.issuer_name ?? "—"}</h1>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {quote.issuer_cif && <p>CIF: {quote.issuer_cif}</p>}
                {quote.issuer_address && <p>{quote.issuer_address}</p>}
                <p>{[quote.issuer_postal_code, quote.issuer_city, quote.issuer_province].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">{isNote ? "ALBARÁN" : "PEDIDO"}</p>
            <p className="text-lg font-bold text-foreground">{quote.full_number ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Fecha: {quote.issue_date ?? "—"}</p>
            {quote.valid_until && <p className="text-xs text-muted-foreground">Válido hasta: {quote.valid_until}</p>}
            <span className={cn("inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-medium print:hidden", STATUS_STYLE[quote.status])}>{STATUS_LABEL[quote.status]}</span>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-1">{isNote ? "ALBARÁN PARA" : "PEDIDO PARA"}</p>
          <p className="font-semibold text-foreground">{quote.client_name ?? quote.client?.name ?? "—"}</p>
          <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
            {quote.client_cif && <p>CIF: {quote.client_cif}</p>}
            {quote.client_address && <p>{quote.client_address}</p>}
            <p>{[quote.client_postal_code, quote.client_city, quote.client_province].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        {/* Lines */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left font-semibold py-2">DESCRIPCIÓN</th>
              <th className="text-right font-semibold py-2 w-16">CANT.</th>
              <th className="text-right font-semibold py-2 w-24">PRECIO</th>
              <th className="text-right font-semibold py-2 w-16">IVA</th>
              <th className="text-right font-semibold py-2 w-28">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.id} className="border-b border-border/60">
                <td className="py-2 text-foreground">{l.description}</td>
                <td className="py-2 text-right text-muted-foreground tabular-nums">{Number(l.quantity)}</td>
                <td className="py-2 text-right text-muted-foreground tabular-nums">{fmtEur(Number(l.unit_price))}</td>
                <td className="py-2 text-right text-muted-foreground tabular-nums">{Number(l.tax_rate)}%</td>
                <td className="py-2 text-right font-semibold text-foreground tabular-nums">{fmtEur(Number(l.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Base imponible</span><span className="tabular-nums">{fmtEur(Number(quote.subtotal))}</span></div>
          {Number(quote.discount_amount) > 0 && <div className="flex justify-between text-muted-foreground"><span>Descuento ({quote.discount_pct}%)</span><span className="tabular-nums">−{fmtEur(Number(quote.discount_amount))}</span></div>}
          <div className="flex justify-between text-muted-foreground"><span>IVA</span><span className="tabular-nums">{fmtEur(Number(quote.tax_amount))}</span></div>
          {Number(quote.retention_amount) > 0 && <div className="flex justify-between text-muted-foreground"><span>Retención ({quote.retention_pct}%)</span><span className="tabular-nums">−{fmtEur(Number(quote.retention_amount))}</span></div>}
          <div className="flex justify-between font-bold text-foreground text-base pt-1 border-t border-border"><span>TOTAL</span><span className="tabular-nums">{fmtEur(Number(quote.total))}</span></div>
          {needsExchangeRate(quote.currency) && quote.exchange_rate != null && (
            <p className="text-[11px] text-muted-foreground pt-1">
              Tipo de cambio: 1 {quote.currency} = {quote.exchange_rate.toFixed(4).replace(".", ",")} € · Equivalente: {formatMoney(toEur(Number(quote.total), quote.currency, quote.exchange_rate), "EUR")}
            </p>
          )}
        </div>

        {quote.notes && <p className="text-xs text-muted-foreground mt-6 pt-4 border-t border-border">{quote.notes}</p>}
        <p className="text-[10px] text-muted-foreground/70 mt-4">
          {isNote
            ? "Este documento es un albarán de entrega y no tiene validez como factura."
            : "Este documento es un pedido y no tiene validez como factura."}
        </p>
      </div>
    </div>
  )
}
