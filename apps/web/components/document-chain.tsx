"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardList, Truck, Receipt, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { quoteStatusLabel } from "@/lib/quote-status"

type Step = { id: string; number: string | null; label: string; href: string } | null
export type Chain = { quote: Step; note: Step; invoice: Step }

/**
 * Follow the Pedido → Albarán → Factura links from any one of them.
 *
 * The links already existed in the data (`quotes.source_quote_id`,
 * `quotes.converted_invoice_id`) but no screen showed them, so the chain the
 * product is sold on was invisible inside the product (WEB-007).
 */
export async function loadChain(start: { kind: "quote" | "delivery_note" | "invoice"; id: string }): Promise<Chain> {
  const supabase: any = createClient()
  const cols = "id, full_number, status, kind, source_quote_id, converted_invoice_id"
  let quote: any = null, note: any = null, invoiceId: string | null = null

  if (start.kind === "invoice") {
    invoiceId = start.id
    const { data } = await supabase.from("quotes").select(cols).eq("converted_invoice_id", start.id).eq("kind", "delivery_note").maybeSingle()
    note = data
  } else if (start.kind === "delivery_note") {
    const { data } = await supabase.from("quotes").select(cols).eq("id", start.id).maybeSingle()
    note = data
  } else {
    const { data } = await supabase.from("quotes").select(cols).eq("id", start.id).maybeSingle()
    quote = data
    const { data: n } = await supabase.from("quotes").select(cols).eq("source_quote_id", start.id).eq("kind", "delivery_note").maybeSingle()
    note = n
  }
  if (note && !quote && note.source_quote_id) {
    const { data } = await supabase.from("quotes").select(cols).eq("id", note.source_quote_id).maybeSingle()
    quote = data
  }
  if (note?.converted_invoice_id) invoiceId = note.converted_invoice_id

  let invoice: any = null
  if (invoiceId) {
    const { data } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle()
    invoice = data
  }

  return {
    quote: quote ? { id: quote.id, number: quote.full_number, label: quoteStatusLabel("quote", quote.status), href: `/pedidos/${quote.id}` } : null,
    note: note ? { id: note.id, number: note.full_number, label: quoteStatusLabel("delivery_note", note.status), href: `/albaranes/${note.id}` } : null,
    invoice: invoice ? { id: invoice.id, number: invoice.full_number, label: invoice.payment_date ? "Cobrada" : invoice.sent_at ? "Enviada" : "Emitida", href: `/facturacion/${invoice.id}` } : null,
  }
}

export function useChain(start: { kind: "quote" | "delivery_note" | "invoice"; id: string } | null) {
  const [chain, setChain] = useState<Chain | null>(null)
  useEffect(() => {
    if (!start) return
    let cancelled = false
    loadChain(start).then(c => { if (!cancelled) setChain(c) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start?.kind, start?.id])
  return chain
}

export function DocumentChain({ chain, current }: {
  chain: Chain | null
  current: "quote" | "delivery_note" | "invoice"
}) {
  if (!chain) return null
  // An invoice issued directly (no order behind it) has no chain to show.
  if (current === "invoice" && !chain.note && !chain.quote) return null
  const steps = [
    { key: "quote" as const, title: "Pedido", icon: ClipboardList, step: chain.quote },
    { key: "delivery_note" as const, title: "Albarán", icon: Truck, step: chain.note },
    { key: "invoice" as const, title: "Factura", icon: Receipt, step: chain.invoice },
  ]
  return (
    <nav aria-label="Cadena del documento" className="flex flex-wrap items-center gap-1.5 mb-5 print:hidden">
      {steps.map((s, i) => {
        const isCurrent = s.key === current
        const body = (
          <span className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors",
            isCurrent ? "border-primary bg-primary/5 text-foreground"
              : s.step ? "border-border bg-card text-foreground hover:bg-muted"
              : "border-dashed border-border text-muted-foreground/70",
          )}>
            <s.icon className={cn("w-3.5 h-3.5", isCurrent ? "text-primary" : "text-muted-foreground")} />
            <span className="font-semibold">{s.title}</span>
            <span className="tabular-nums">{s.step?.number ?? (s.key === "invoice" ? "sin facturar" : "—")}</span>
            {s.step && <span className="text-muted-foreground">· {s.step.label}</span>}
          </span>
        )
        return (
          <span key={s.key} className="flex items-center gap-1.5">
            {s.step && !isCurrent ? <Link href={s.step.href}>{body}</Link> : body}
            {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
          </span>
        )
      })}
    </nav>
  )
}
