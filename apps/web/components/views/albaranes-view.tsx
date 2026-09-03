"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardList, Download, ArrowRight, Loader2, FileText, FolderPlus, ListChecks, Printer, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { useQuotes, fetchQuoteWithLines, type Quote } from "@/lib/hooks/use-quotes"
import { useProducts } from "@/lib/hooks/use-products"
import { getStockWarnings, type StockWarning } from "@/lib/stock"
import { formatMoney } from "@/lib/currency"
import { TutorialHelpButton } from "@/components/tutorial-help-button"
import { StockWarningModal } from "@/components/stock-warning-modal"

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto",
  converted: "Facturado",
}
const STATUS_STYLE: Record<string, string> = {
  open:      "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  converted: "bg-accent/10 text-accent",
}

/**
 * Albaranes — the step between a quote and its invoice.
 *
 * A delivery note is opened automatically when a quote is finalized, so there
 * is nothing to create here: the list exists to bill them. Billing only ever
 * happens from this screen, which is what keeps a single path to an invoice.
 */
export function AlbaranesView() {
  const router = useRouter()
  const { currentOrg, isOrgAdmin } = useOrganization()
  const { quotes: notes, loading, mutate } = useQuotes(currentOrg?.id ?? null, "delivery_note")
  const { products } = useProducts(currentOrg?.id ?? null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [stockCheck, setStockCheck] = useState<{ note: Quote; warnings: StockWarning[] } | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [printing, setPrinting] = useState(false)

  const toggleSelectMode = () => {
    setSelectMode(m => !m)
    setSelected(new Set())
  }

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // A checklist to review by hand before billing — not a change to how
  // billing itself works. Each albarán still converts one at a time from
  // this same screen, exactly as before.
  const handlePrintList = async () => {
    if (!currentOrg || selected.size === 0) return
    setPrinting(true)
    try {
      const res = await fetch("/api/quotes/print-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrg.id, ids: Array.from(selected) }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.detail ?? json.error ?? "No se pudo generar el listado.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (e) {
      alert(String(e))
    } finally {
      setPrinting(false)
    }
  }

  // Los albaranes se archivan solos al abrirse, pero eso es best-effort y los
  // abiertos antes de que existiera el archivado no tienen copia. Esto lo
  // repara sin tener que tocar la base de datos a mano.
  const sinArchivar = notes.filter(n => !n.document_id).length
  const handleArchive = async () => {
    if (!currentOrg) return
    setArchiving(true)
    try {
      const res = await fetch("/api/quotes/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrg.id }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.detail ?? json.error ?? "No se pudo archivar."); return }
      await mutate()
      alert(json.archivados?.length
        ? `Archivados en la biblioteca: ${json.archivados.join(", ")}`
        : "No había nada pendiente de archivar.")
    } catch (e) {
      alert(String(e))
    } finally {
      setArchiving(false)
    }
  }

  const open = notes.filter(n => n.status !== "converted")
  const billed = notes.filter(n => n.status === "converted")

  const doBill = async (n: Quote) => {
    setBusyId(n.id)
    try {
      const res = await fetch("/api/quotes/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: n.id }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.detail ?? json.error ?? "No se pudo emitir la factura."); setBusyId(null); return }
      await mutate()
      router.push(`/facturacion/${json.invoiceId}`)
    } catch (e) {
      alert(String(e))
    } finally {
      setBusyId(null)
    }
  }

  const handleBill = async (n: Quote) => {
    if (!confirm(`¿Emitir la factura del albarán ${n.full_number ?? ""}? Se emitirá con Verifactu y no podrá deshacerse.`)) return
    const data = await fetchQuoteWithLines(n.id)
    const warnings = data
      ? getStockWarnings(data.lines.map(l => ({ productId: l.product_id, quantity: Number(l.quantity) })), products)
      : []
    if (warnings.length) { setStockCheck({ note: n, warnings }); return }
    await doBill(n)
  }

  const row = (n: Quote, selectable = false) => (
    <div key={n.id} className={cn(
      "flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors",
      busyId === n.id && "opacity-50 pointer-events-none",
    )}>
      {selectMode && (
        selectable ? (
          <input
            type="checkbox"
            checked={selected.has(n.id)}
            onChange={() => toggleSelected(n.id)}
            className="w-4 h-4 shrink-0 accent-accent"
          />
        ) : <span className="w-4 shrink-0" />
      )}
      <Link href={`/presupuestos/${n.id}`} className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate hover:text-accent">{n.full_number ?? "—"}</p>
        <p className="text-xs text-muted-foreground truncate">
          {n.client?.name ?? n.client_name ?? "—"} · {n.issue_date ?? ""}
        </p>
      </Link>
      <span className="hidden sm:block text-sm font-semibold text-foreground tabular-nums w-28 text-right">
        {formatMoney(Number(n.total), n.currency)}
      </span>
      <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium shrink-0", STATUS_STYLE[n.status])}>
        {STATUS_LABEL[n.status] ?? n.status}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <a href={`/api/quotes/pdf?id=${n.id}`} title="Descargar PDF" className="p-1.5 rounded hover:bg-muted transition-colors">
          <Download className="w-4 h-4 text-muted-foreground" />
        </a>
        {isOrgAdmin && n.status !== "converted" && (
          <button onClick={() => handleBill(n)} title="Emitir factura" className="p-1.5 rounded hover:bg-accent/10 transition-colors">
            {busyId === n.id ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <ArrowRight className="w-4 h-4 text-accent" />}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              Albaranes
              <TutorialHelpButton slide={["deliveryNotes", "quotes"]} />
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Se abre uno por cada pedido. Desde aquí se emite su factura.
            </p>
          </div>
          {open.length > 0 && (
            <button
              onClick={toggleSelectMode}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl transition-colors shrink-0",
                selectMode ? "bg-muted text-foreground" : "bg-card border border-border hover:bg-muted",
              )}
            >
              {selectMode ? <X className="w-4 h-4" /> : <ListChecks className="w-4 h-4" />}
              {selectMode ? "Cancelar selección" : "Seleccionar para imprimir"}
            </button>
          )}
        </div>
        {isOrgAdmin && sinArchivar > 0 && (
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-card border border-border rounded-xl hover:bg-muted disabled:opacity-60 transition-colors"
          >
            {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
            Archivar {sinArchivar} en la biblioteca
          </button>
        )}
      </div>

      {selectMode && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{selected.size}</span> seleccionado{selected.size === 1 ? "" : "s"}
          </p>
          <button
            onClick={handlePrintList}
            disabled={selected.size === 0 || printing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Imprimir listado
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary mb-3" />
            <p className="text-sm text-muted-foreground">Cargando…</p>
          </div>
        ) : open.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No hay albaranes abiertos</p>
            <p className="text-xs text-muted-foreground">Se crean solos al guardar un pedido.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">{open.map(n => row(n, true))}</div>
        )}
      </div>

      {billed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Ya facturados</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden opacity-75">
            <div className="divide-y divide-border">{billed.map(n => row(n, false))}</div>
          </div>
        </div>
      )}

      {stockCheck && (
        <StockWarningModal
          warnings={stockCheck.warnings}
          note="La factura se emitirá con Verifactu y no podrá deshacerse."
          onCancel={() => setStockCheck(null)}
          onConfirm={async () => {
            const n = stockCheck.note
            setStockCheck(null)
            await doBill(n)
          }}
        />
      )}
    </div>
  )
}
