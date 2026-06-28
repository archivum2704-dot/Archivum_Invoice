"use client"

import { useState } from "react"
import { Package, Plus, Pencil, Trash2, X, Check, Loader2, Lock, AlertTriangle, Search } from "lucide-react"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { useProducts, type Product } from "@/lib/hooks/use-products"
import { createClient } from "@/lib/supabase/client"
import { isPaidPlan } from "@/lib/plan"

type Draft = {
  name: string
  sku: string
  description: string
  unit: string
  unit_price: string
  tax_rate: string
  track_stock: boolean
  stock_qty: string
}

const EMPTY: Draft = {
  name: "", sku: "", description: "", unit: "ud",
  unit_price: "0", tax_rate: "21", track_stock: true, stock_qty: "0",
}

export function InventarioView() {
  const t = useTranslations("inventory")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const { currentOrg, isOrgAdmin } = useOrganization()
  const paid = isPaidPlan(currentOrg)
  const { products, loading, mutate } = useProducts(currentOrg?.id ?? null)

  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Product | "new" | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canManage = isOrgAdmin && paid

  const fmtEur = (n: number) => `${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

  const openNew = () => { setDraft(EMPTY); setError(null); setEditing("new") }
  const openEdit = (p: Product) => {
    setDraft({
      name: p.name, sku: p.sku ?? "", description: p.description ?? "", unit: p.unit,
      unit_price: String(p.unit_price), tax_rate: String(p.tax_rate),
      track_stock: p.track_stock, stock_qty: String(p.stock_qty),
    })
    setError(null); setEditing(p)
  }

  const handleSave = async () => {
    if (!draft.name.trim() || !currentOrg) return
    setSaving(true); setError(null)
    const supabase = createClient()
    const payload = {
      organization_id: currentOrg.id,
      name: draft.name.trim(),
      sku: draft.sku.trim() || null,
      description: draft.description.trim() || null,
      unit: draft.unit.trim() || "ud",
      unit_price: Number(draft.unit_price) || 0,
      tax_rate: Number(draft.tax_rate) || 0,
      track_stock: draft.track_stock,
      stock_qty: draft.track_stock ? (Number(draft.stock_qty) || 0) : 0,
    }
    const res = editing === "new"
      ? await supabase.from("products").insert(payload)
      : await supabase.from("products").update(payload).eq("id", (editing as Product).id)
    if (res.error) { setError(res.error.message); setSaving(false); return }
    await mutate()
    setSaving(false); setEditing(null)
  }

  const handleDelete = async (p: Product) => {
    if (!confirm(t("deleteConfirm", { name: p.name }))) return
    setDeletingId(p.id)
    const supabase = createClient()
    // Soft-delete so issued invoices keep their product reference
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", p.id)
    if (!error) await mutate()
    setDeletingId(null)
  }

  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? "").toLowerCase().includes(search.toLowerCase())
  )

  // ── Paywall for free plans ──────────────────────────────────
  if (!paid) {
    return (
      <div className="p-6 sm:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <Package className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t("paywallTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{t("paywallBody")}</p>
          <Link
            href="/configuracion/billing"
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            {t("upgrade")}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2.5">
          <Package className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tCommon("search")}
              className="pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-xl w-44 sm:w-56 focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          {canManage && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> {t("newProduct")}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_120px_110px_70px_90px_80px] gap-3 px-5 py-3 border-b border-border text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
          <span>{t("name")}</span>
          <span>{t("sku")}</span>
          <span className="text-right">{t("unitPrice")}</span>
          <span className="text-right">{t("tax")}</span>
          <span className="text-right">{t("stock")}</span>
          <span></span>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <Package className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">{t("empty")}</p>
            {canManage && (
              <button onClick={openNew} className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                <Plus className="w-3.5 h-3.5" /> {t("newProduct")}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map(p => (
              <div
                key={p.id}
                className={cn(
                  "grid grid-cols-2 sm:grid-cols-[1fr_120px_110px_70px_90px_80px] gap-3 px-5 py-3.5 items-center group hover:bg-muted/30 transition-colors",
                  deletingId === p.id && "opacity-40 pointer-events-none"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                </div>
                <span className="text-sm text-muted-foreground truncate hidden sm:block">{p.sku ?? "—"}</span>
                <span className="text-sm font-semibold text-foreground text-right">{fmtEur(p.unit_price)}</span>
                <span className="text-sm text-muted-foreground text-right hidden sm:block">{Number(p.tax_rate)}%</span>
                <span className="text-sm text-right">
                  {p.track_stock
                    ? <span className={cn("font-semibold", Number(p.stock_qty) <= 0 ? "text-[var(--status-overdue)]" : "text-foreground")}>{Number(p.stock_qty)}</span>
                    : <span className="text-muted-foreground/60">—</span>}
                </span>
                <div className="flex items-center justify-end gap-1">
                  {canManage && (
                    <>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title={tCommon("edit")}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title={tCommon("delete")}>
                        <Trash2 className="w-3.5 h-3.5" />
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
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setEditing(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">{editing === "new" ? t("newProduct") : t("editProduct")}</h2>
              <button onClick={() => !saving && setEditing(null)} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            <div className="space-y-4">
              <Field label={t("name")} required>
                <input autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("sku")}>
                  <input value={draft.sku} onChange={e => setDraft({ ...draft, sku: e.target.value })} className={inputCls} />
                </Field>
                <Field label={t("unit")}>
                  <input value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <Field label={t("description")}>
                <input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`${t("unitPrice")} (€)`}>
                  <input type="number" step="0.01" min="0" value={draft.unit_price} onChange={e => setDraft({ ...draft, unit_price: e.target.value })} className={inputCls} />
                </Field>
                <Field label={`${t("tax")} (%)`}>
                  <input type="number" step="0.01" min="0" value={draft.tax_rate} onChange={e => setDraft({ ...draft, tax_rate: e.target.value })} className={inputCls} />
                </Field>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={draft.track_stock} onChange={e => setDraft({ ...draft, track_stock: e.target.checked })} className="w-4 h-4 rounded accent-primary" />
                {t("trackStock")}
              </label>
              {draft.track_stock && (
                <Field label={t("stock")}>
                  <input type="number" step="1" value={draft.stock_qty} onChange={e => setDraft({ ...draft, stock_qty: e.target.value })} className={inputCls} />
                </Field>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => !saving && setEditing(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {tCommon("cancel")}
              </button>
              <button onClick={handleSave} disabled={saving || !draft.name.trim()} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {tCommon("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
