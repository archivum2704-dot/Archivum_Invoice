"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardList, Download, ArrowRight, Loader2, FileText, FolderPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { useQuotes, type Quote } from "@/lib/hooks/use-quotes"

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto",
  converted: "Facturado",
}
const STATUS_STYLE: Record<string, string> = {
  open:      "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  converted: "bg-accent/10 text-accent",
}

const fmtEur = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

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
  const [busyId, setBusyId] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)

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

  const handleBill = async (n: Quote) => {
    if (!confirm(`¿Emitir la factura del albarán ${n.full_number ?? ""}? Se emitirá con Verifactu y no podrá deshacerse.`)) return
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

  const row = (n: Quote) => (
    <div key={n.id} className={cn(
      "flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors",
      busyId === n.id && "opacity-50 pointer-events-none",
    )}>
      <Link href={`/presupuestos/${n.id}`} className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate hover:text-accent">{n.full_number ?? "—"}</p>
        <p className="text-xs text-muted-foreground truncate">
          {n.client?.name ?? n.client_name ?? "—"} · {n.issue_date ?? ""}
        </p>
      </Link>
      <span className="hidden sm:block text-sm font-semibold text-foreground tabular-nums w-28 text-right">
        {fmtEur(Number(n.total))}
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
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-6 h-6" />
          Albaranes
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Se abre uno por cada presupuesto. Desde aquí se emite su factura.
        </p>
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
            <p className="text-xs text-muted-foreground">Se crean solos al guardar un presupuesto.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">{open.map(row)}</div>
        )}
      </div>

      {billed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Ya facturados</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden opacity-75">
            <div className="divide-y divide-border">{billed.map(row)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
