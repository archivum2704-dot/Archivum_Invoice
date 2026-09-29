"use client"

import { useMemo, useState } from "react"
import { X, Check, Loader2, AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import type { Product } from "@/lib/hooks/use-products"

type Draft = {
  name: string
  sku: string
  category: string
  description: string
  unit: string
  unit_price: string
  tax_rate: string
  track_stock: boolean
  stock_qty: string
  min_stock: string
}

const EMPTY: Draft = {
  name: "", sku: "", category: "", description: "", unit: "ud",
  unit_price: "0", tax_rate: "21", track_stock: true, stock_qty: "0", min_stock: "",
}

const toDraft = (p: Product): Draft => ({
  name: p.name, sku: p.sku ?? "", category: p.category ?? "", description: p.description ?? "", unit: p.unit,
  unit_price: String(p.unit_price), tax_rate: String(p.tax_rate),
  track_stock: p.track_stock, stock_qty: String(p.stock_qty),
  min_stock: p.min_stock == null ? "" : String(p.min_stock),
})

const inputCls = "w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"

/**
 * Create or edit a product.
 *
 * Inventario and the invoice form both need it — the invoice so a product can
 * be added without abandoning a half-written invoice, the same way a client
 * can. One component serves both so the two cannot drift apart, which is
 * what happened with the client form when each screen had its own copy.
 */
export function ProductFormModal({ orgId, product, products, initial, onSaved, onClose }: {
  orgId: string
  /** Product to edit; omit to create a new one. */
  product?: Product | null
  /** Existing catalogue — for the next automatic reference and the category list. */
  products: Product[]
  /** Pre-fills a new product (e.g. from what was typed in an invoice line). */
  initial?: Partial<Pick<Draft, "name" | "unit_price" | "tax_rate">>
  /** Receives the saved product's id so the caller can select it. */
  onSaved: (id: string) => Promise<void> | void
  onClose: () => void
}) {
  const t = useTranslations("inventory")
  const tCommon = useTranslations("common")
  const [draft, setDraft] = useState<Draft>(() => product ? toDraft(product) : { ...EMPTY, ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => { if (!saving) onClose() }

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map(p => p.category?.trim()).filter((c): c is string => !!c))
      ).sort((a, b) => a.localeCompare(b)),
    [products],
  )

  // Next free auto reference (REF-0001, REF-0002…) based on existing products
  const nextAutoSku = () => {
    let max = 0
    for (const p of products) {
      const m = /^REF-(\d+)$/i.exec(p.sku?.trim() ?? "")
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return `REF-${String(max + 1).padStart(4, "0")}`
  }

  const handleSave = async () => {
    if (!draft.name.trim() || !orgId) return
    setSaving(true); setError(null)
    const supabase = createClient()
    const payload = {
      organization_id: orgId,
      name: draft.name.trim(),
      sku: draft.sku.trim() || nextAutoSku(),
      category: draft.category.trim() || null,
      description: draft.description.trim() || null,
      unit: draft.unit.trim() || "ud",
      unit_price: Number(draft.unit_price) || 0,
      tax_rate: Number(draft.tax_rate) || 0,
      track_stock: draft.track_stock,
      stock_qty: draft.track_stock ? (Number(draft.stock_qty) || 0) : 0,
      // Blank means "not watched" — distinct from a floor of 0, which would
      // only ever warn once the product had already run out.
      min_stock: draft.track_stock && draft.min_stock.trim() !== ""
        ? Number(draft.min_stock) || 0
        : null,
    }
    // The id is generated here so the caller can select the new product
    // straight away without reading the row back.
    const id = product?.id ?? crypto.randomUUID()
    const res = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert({ id, ...payload })
    if (res.error) { setError(res.error.message); setSaving(false); return }
    await onSaved(id)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">{product ? t("editProduct") : t("newProduct")}</h2>
          <button onClick={close} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-4">
          <Field label={t("name")} required>
            <input autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("sku")}>
              <input value={draft.sku} onChange={e => setDraft({ ...draft, sku: e.target.value })} placeholder={t("skuPlaceholder")} className={inputCls} />
            </Field>
            <Field label={t("unit")}>
              <input value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })} placeholder={t("unitPlaceholder")} className={inputCls} />
            </Field>
          </div>
          <Field label={t("category")}>
            <input
              list="product-categories"
              value={draft.category}
              onChange={e => setDraft({ ...draft, category: e.target.value })}
              placeholder={t("categoryPlaceholder")}
              className={inputCls}
            />
            <datalist id="product-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </Field>
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
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("stock")}>
                <input type="number" step="1" value={draft.stock_qty} onChange={e => setDraft({ ...draft, stock_qty: e.target.value })} className={inputCls} />
              </Field>
              <Field label={t("minStock")}>
                <input type="number" step="1" min="0" placeholder={t("minStockPlaceholder")}
                  value={draft.min_stock} onChange={e => setDraft({ ...draft, min_stock: e.target.value })} className={inputCls} />
              </Field>
              <p className="col-span-2 -mt-1 text-[11px] text-muted-foreground">{t("minStockHint")}</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={close} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {tCommon("cancel")}
          </button>
          <button onClick={handleSave} disabled={saving || !draft.name.trim()} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {tCommon("save")}
          </button>
        </div>
      </div>
    </div>
  )
}

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
