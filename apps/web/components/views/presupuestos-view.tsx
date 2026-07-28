"use client"

import { useState, useMemo } from "react"
import {
  ClipboardList, Plus, X, Trash2, Loader2, Lock, Download, Pencil, ArrowRight, FileText,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { useQuotes, fetchQuoteWithLines, type Quote } from "@/lib/hooks/use-quotes"
import { useCompanies } from "@/lib/hooks/use-companies"
import { isPaidPlan } from "@/lib/plan"
import { createClient } from "@/lib/supabase/client"

type Line = { productId: string | null; description: string; quantity: string; unitPrice: string; taxRate: string }
const emptyLine = (): Line => ({ productId: null, description: "", quantity: "1", unitPrice: "0", taxRate: "21" })

const IVA_RATES = ["", "4", "10", "21"]
const RETENTION_RATES = ["", "7", "15", "19"]
const DISCOUNT_RATES = ["", "5", "10", "15", "20"]

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador", sent: "Enviado", accepted: "Aceptado", rejected: "Rechazado", converted: "Facturado",
}
const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground",
  sent:      "bg-primary/10 text-primary",
  accepted:  "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  rejected:  "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
  converted: "bg-accent/10 text-accent",
}

const fmtEur = (n: number) => `${(n ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function PresupuestosView() {
  const router = useRouter()
  const { currentOrg, isOrgAdmin, isPlatformAdmin } = useOrganization()
  const paid = isPaidPlan(currentOrg) || isPlatformAdmin
  const { quotes, loading, mutate } = useQuotes(currentOrg?.id ?? null)
  const { companies } = useCompanies(currentOrg?.id ?? null)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [clientId, setClientId] = useState("")
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState("")
  const [discountPct, setDiscountPct] = useState("")
  const [retentionPct, setRetentionPct] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const inputCls = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"

  const totals = useMemo(() => {
    let grossBase = 0, grossTax = 0
    for (const l of lines) {
      const base = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)
      grossBase += base
      grossTax += base * (Number(l.taxRate) || 0) / 100
    }
    const disc = Number(discountPct) || 0
    const discountAmount = grossBase * disc / 100
    const netBase = grossBase - discountAmount
    const tax = grossTax * (1 - disc / 100)
    const ret = netBase * (Number(retentionPct) || 0) / 100
    return { subtotal: grossBase, discountAmount, tax, retention: ret, total: netBase + tax - ret }
  }, [lines, discountPct, retentionPct])

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))

  const resetForm = () => {
    setEditId(null); setClientId(""); setIssueDate(new Date().toISOString().slice(0, 10))
    setValidUntil(""); setDiscountPct(""); setRetentionPct(""); setNotes(""); setLines([emptyLine()]); setError(null)
  }

  const openNew = () => { resetForm(); setOpen(true) }

  const openEdit = async (q: Quote) => {
    resetForm()
    const data = await fetchQuoteWithLines(q.id)
    if (!data) return
    setEditId(q.id)
    setClientId(q.client_company_id ?? "")
    setIssueDate(q.issue_date ?? new Date().toISOString().slice(0, 10))
    setValidUntil(q.valid_until ?? "")
    setDiscountPct(q.discount_pct != null ? String(q.discount_pct) : "")
    setRetentionPct(q.retention_pct != null ? String(q.retention_pct) : "")
    setNotes(q.notes ?? "")
    setLines(data.lines.length ? data.lines.map(l => ({
      productId: l.product_id, description: l.description,
      quantity: String(l.quantity), unitPrice: String(l.unit_price), taxRate: String(l.tax_rate),
    })) : [emptyLine()])
    setOpen(true)
  }

  const handleSave = async () => {
    if (!currentOrg) return
    if (!clientId) { setError("Selecciona un cliente."); return }
    if (!lines.some(l => l.description.trim())) { setError("Añade al menos una línea."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId, orgId: currentOrg.id, clientCompanyId: clientId, status: "sent",
          issueDate, validUntil: validUntil || null, notes,
          discountPct: Number(discountPct) || 0, retentionPct: Number(retentionPct) || 0,
          lines: lines.filter(l => l.description.trim()).map(l => ({
            productId: l.productId, description: l.description,
            quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, taxRate: Number(l.taxRate) || 0,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.detail ?? json.error ?? "No se pudo guardar el presupuesto."); setSaving(false); return }
      await mutate(); setOpen(false); resetForm()
    } catch (e) { setError(String(e)) }
    setSaving(false)
  }

  const handleConvert = async (q: Quote) => {
    if (!confirm(`¿Convertir el presupuesto ${q.full_number ?? ""} en factura? Se emitirá una factura con Verifactu.`)) return
    setBusyId(q.id)
    try {
      const res = await fetch("/api/quotes/convert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: q.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { alert(json.detail ?? json.error ?? "No se pudo convertir."); setBusyId(null); return }
      await mutate()
      router.push(`/facturacion/${json.invoiceId}`)
    } catch (e) { alert(String(e)); setBusyId(null) }
  }

  const handleDelete = async (q: Quote) => {
    if (!confirm("¿Eliminar este presupuesto? Esta acción no se puede deshacer.")) return
    setBusyId(q.id)
    const supabase: any = createClient()
    await supabase.from("quotes").delete().eq("id", q.id)
    await mutate(); setBusyId(null)
  }

  if (!paid) {
    return (
      <div className="p-6 sm:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <ClipboardList className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Presupuestos</h1>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Función de plan de pago</h2>
          <p className="text-sm text-muted-foreground mb-6">Crea y envía presupuestos con tu logo, y conviértelos en factura con un clic.</p>
          <Link href="/configuracion/billing" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
            Ver planes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Presupuestos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Crea presupuestos, compártelos y conviértelos en factura.</p>
          </div>
        </div>
        {isOrgAdmin && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nuevo presupuesto
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Aún no hay presupuestos</p>
            <p className="text-xs text-muted-foreground">Crea el primero con el botón de arriba.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {quotes.map(q => (
              <div key={q.id} className={cn("flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors", busyId === q.id && "opacity-50 pointer-events-none")}>
                <Link href={`/presupuestos/${q.id}`} className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate hover:text-accent">{q.full_number ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{q.client?.name ?? q.client_name ?? "—"} · {q.issue_date ?? ""}</p>
                </Link>
                <span className="hidden sm:block text-sm font-semibold text-foreground tabular-nums w-28 text-right">{fmtEur(Number(q.total))}</span>
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium shrink-0", STATUS_STYLE[q.status])}>{STATUS_LABEL[q.status]}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={`/api/quotes/pdf?id=${q.id}`} title="Descargar PDF" className="p-1.5 rounded hover:bg-muted transition-colors">
                    <Download className="w-4 h-4 text-muted-foreground" />
                  </a>
                  {isOrgAdmin && q.status !== "converted" && (
                    <>
                      <button onClick={() => openEdit(q)} title="Editar" className="p-1.5 rounded hover:bg-muted transition-colors">
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleConvert(q)} title="Convertir a factura" className="p-1.5 rounded hover:bg-accent/10 transition-colors">
                        {busyId === q.id ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <ArrowRight className="w-4 h-4 text-accent" />}
                      </button>
                      <button onClick={() => handleDelete(q)} title="Eliminar" className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">{editId ? "Editar presupuesto" : "Nuevo presupuesto"}</h2>
              <button onClick={() => !saving && setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1.5">Cliente <span className="text-destructive">*</span></label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
                  <option value="">Selecciona un cliente…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.cif ? ` · ${c.cif}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Fecha</label>
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Válido hasta</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Descuento</label>
                <select value={discountPct} onChange={e => setDiscountPct(e.target.value)} className={inputCls}>
                  {DISCOUNT_RATES.map(r => <option key={r} value={r}>{r === "" ? "Sin descuento" : `${r}%`}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Retención IRPF</label>
                <select value={retentionPct} onChange={e => setRetentionPct(e.target.value)} className={inputCls}>
                  {RETENTION_RATES.map(r => <option key={r} value={r}>{r === "" ? "Sin retención" : `${r}%`}</option>)}
                </select>
              </div>
            </div>

            {/* Lines */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Líneas</label>
                <button onClick={() => setLines([...lines, emptyLine()])} className="flex items-center gap-1 text-xs text-accent hover:underline font-medium">
                  <Plus className="w-3.5 h-3.5" /> Añadir línea
                </button>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_56px_72px_56px_auto] gap-2 items-center">
                    <input placeholder="Descripción" value={l.description} onChange={e => setLine(i, { description: e.target.value })} className={cn(inputCls, "py-1.5")} />
                    <input type="number" step="0.01" title="Cantidad" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} className={cn(inputCls, "py-1.5 text-right")} />
                    <input type="number" step="0.01" title="Precio" value={l.unitPrice} onChange={e => setLine(i, { unitPrice: e.target.value })} className={cn(inputCls, "py-1.5 text-right")} />
                    <select title="IVA" value={l.taxRate} onChange={e => setLine(i, { taxRate: e.target.value })} className={cn(inputCls, "py-1.5 px-1 text-right")}>
                      {IVA_RATES.map(r => <option key={r} value={r}>{r === "" ? "0%" : `${r}%`}</option>)}
                    </select>
                    <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} disabled={lines.length === 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Base imponible</span><span>{fmtEur(totals.subtotal)}</span></div>
              {totals.discountAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Descuento ({discountPct}%)</span><span>−{fmtEur(totals.discountAmount)}</span></div>}
              <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>{fmtEur(totals.tax)}</span></div>
              {totals.retention > 0 && <div className="flex justify-between text-muted-foreground"><span>Retención ({retentionPct}%)</span><span>−{fmtEur(totals.retention)}</span></div>}
              <div className="flex justify-between font-bold text-foreground text-base"><span>Total</span><span>{fmtEur(totals.total)}</span></div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-foreground mb-1.5">Notas</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="Condiciones, validez, forma de pago…" />
            </div>

            {error && <p className="text-destructive text-sm mt-3">{error}</p>}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => !saving && setOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                {editId ? "Guardar cambios" : "Crear presupuesto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
