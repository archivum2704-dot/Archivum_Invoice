"use client"

import { useState, useMemo } from "react"
import {
  Package, Plus, Pencil, Trash2, X, Check, Loader2, Lock, AlertTriangle,
  Search, SlidersHorizontal, Tag, Boxes, ArrowUpDown,
} from "lucide-react"
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
  category: string
  description: string
  unit: string
  unit_price: string
  tax_rate: string
  track_stock: boolean
  stock_qty: string
}

const EMPTY: Draft = {
  name: "", sku: "", category: "", description: "", unit: "ud",
  unit_price: "0", tax_rate: "21", track_stock: true, stock_qty: "0",
}

// Sentinel for the "uncategorized" filter option
const UNCATEGORIZED = "__uncategorized__"

type StockFilter = "in" | "out" | "untracked"
type SortKey = "name_asc" | "name_desc" | "price_desc" | "price_asc" | "stock_desc" | "stock_asc"

export function InventarioView() {
  const t = useTranslations("inventory")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const { currentOrg, isOrgAdmin, isPlatformAdmin } = useOrganization()
  const paid = isPaidPlan(currentOrg) || isPlatformAdmin
  const { products, loading, mutate } = useProducts(currentOrg?.id ?? null)

  const [search, setSearch] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTaxes, setSelectedTaxes] = useState<string[]>([])
  const [stockFilters, setStockFilters] = useState<StockFilter[]>([])
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name_asc")

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
      name: p.name, sku: p.sku ?? "", category: p.category ?? "", description: p.description ?? "", unit: p.unit,
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
      category: draft.category.trim() || null,
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

  // Distinct categories present in the inventory (for filters + datalist)
  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map(p => p.category?.trim()).filter((c): c is string => !!c))
      ).sort((a, b) => a.localeCompare(b)),
    [products],
  )
  const hasUncategorized = useMemo(() => products.some(p => !p.category?.trim()), [products])

  // Distinct tax rates present (for the VAT filter)
  const taxRates = useMemo(
    () =>
      Array.from(new Set(products.map(p => Number(p.tax_rate))))
        .sort((a, b) => a - b)
        .map(String),
    [products],
  )

  const toggle = <T extends string>(arr: T[], setArr: (a: T[]) => void, val: T) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])

  const clearAll = () => {
    setSelectedCategories([]); setSelectedTaxes([]); setStockFilters([])
    setPriceMin(""); setPriceMax("")
  }

  const activeCount =
    selectedCategories.length + selectedTaxes.length + stockFilters.length +
    (priceMin ? 1 : 0) + (priceMax ? 1 : 0)

  const stockOf = (p: Product): StockFilter =>
    !p.track_stock ? "untracked" : Number(p.stock_qty) > 0 ? "in" : "out"

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const min = priceMin ? parseFloat(priceMin.replace(",", ".")) : null
    const max = priceMax ? parseFloat(priceMax.replace(",", ".")) : null

    const list = products.filter(p => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      if (!matchesSearch) return false

      if (selectedCategories.length) {
        const key = p.category?.trim() || UNCATEGORIZED
        if (!selectedCategories.includes(key)) return false
      }
      if (selectedTaxes.length && !selectedTaxes.includes(String(Number(p.tax_rate)))) return false
      if (stockFilters.length && !stockFilters.includes(stockOf(p))) return false
      if (min != null && Number(p.unit_price) < min) return false
      if (max != null && Number(p.unit_price) > max) return false
      return true
    })

    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "name_asc":   return a.name.localeCompare(b.name)
        case "name_desc":  return b.name.localeCompare(a.name)
        case "price_asc":  return Number(a.unit_price) - Number(b.unit_price)
        case "price_desc": return Number(b.unit_price) - Number(a.unit_price)
        case "stock_asc":  return Number(a.stock_qty) - Number(b.stock_qty)
        case "stock_desc": return Number(b.stock_qty) - Number(a.stock_qty)
      }
    })
  }, [products, search, selectedCategories, selectedTaxes, stockFilters, priceMin, priceMax, sortKey])

  // Product count per category (for the filter checkboxes)
  const countByCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) {
      const k = p.category?.trim() || UNCATEGORIZED
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [products])

  // Group by category only when no category is explicitly selected; otherwise flat.
  const groups = useMemo(() => {
    if (selectedCategories.length > 0 || categories.length === 0) return null
    const m = new Map<string, Product[]>()
    for (const p of filtered) {
      const k = p.category?.trim() || UNCATEGORIZED
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return Array.from(m.keys())
      .sort((a, b) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b)))
      .map(k => ({ key: k, label: k === UNCATEGORIZED ? t("uncategorized") : k, items: m.get(k)! }))
  }, [filtered, selectedCategories, categories, t])

  const renderRow = (p: Product) => (
    <div
      key={p.id}
      className={cn(
        "grid grid-cols-2 sm:grid-cols-[1fr_120px_110px_70px_90px_80px] gap-3 px-5 py-3.5 items-center group hover:bg-muted/30 transition-colors",
        deletingId === p.id && "opacity-40 pointer-events-none"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          {p.category && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
              {p.category}
            </span>
          )}
          {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
        </div>
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
  )

  const tableHeader = (
    <div className="hidden sm:grid grid-cols-[1fr_120px_110px_70px_90px_80px] gap-3 px-5 py-3 border-b border-border text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
      <span>{t("name")}</span>
      <span>{t("sku")}</span>
      <span className="text-right">{t("unitPrice")}</span>
      <span className="text-right">{t("tax")}</span>
      <span className="text-right">{t("stock")}</span>
      <span></span>
    </div>
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
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <Package className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>
        {canManage && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> {t("newProduct")}
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full pl-12 pr-10 py-3.5 text-base bg-card border-2 border-border rounded-xl focus:outline-none focus:border-primary placeholder:text-muted-foreground transition-colors"
        />
        {search && (
          <button onClick={() => setSearch("")} aria-label={tCommon("clear")} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters sidebar */}
        <aside className="lg:w-60 shrink-0">
          <div className="bg-card border border-border rounded-xl p-4 lg:sticky lg:top-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{t("filters")}</span>
                {activeCount > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium">{activeCount}</span>
                )}
              </div>
              {activeCount > 0 && (
                <button onClick={clearAll} className="text-xs text-primary hover:underline">{t("clearFilters")}</button>
              )}
            </div>

            {/* Category */}
            {(categories.length > 0 || hasUncategorized) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("categoryFilter")}</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {categories.map(c => (
                    <FilterRow
                      key={c} label={c} count={countByCategory.get(c) ?? 0}
                      checked={selectedCategories.includes(c)}
                      onChange={() => toggle(selectedCategories, setSelectedCategories, c)}
                    />
                  ))}
                  {hasUncategorized && (
                    <FilterRow
                      label={t("uncategorized")} count={countByCategory.get(UNCATEGORIZED) ?? 0}
                      checked={selectedCategories.includes(UNCATEGORIZED)}
                      onChange={() => toggle(selectedCategories, setSelectedCategories, UNCATEGORIZED)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Stock */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Boxes className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stockFilter")}</p>
              </div>
              <div className="space-y-1.5">
                {(["in", "out", "untracked"] as const).map(s => (
                  <FilterRow
                    key={s}
                    label={s === "in" ? t("inStock") : s === "out" ? t("outOfStock") : t("untracked")}
                    checked={stockFilters.includes(s)}
                    onChange={() => toggle(stockFilters, setStockFilters, s)}
                  />
                ))}
              </div>
            </div>

            {/* VAT */}
            {taxRates.length > 1 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("taxFilter")}</p>
                </div>
                <div className="space-y-1.5">
                  {taxRates.map(r => (
                    <FilterRow
                      key={r} label={`${r}%`}
                      checked={selectedTaxes.includes(r)}
                      onChange={() => toggle(selectedTaxes, setSelectedTaxes, r)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Price range */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("priceFilter")}</p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("priceMin")}</p>
                  <input type="number" min="0" placeholder="0" value={priceMin} onChange={e => setPriceMin(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("priceMax")}</p>
                  <input type="number" min="0" placeholder="∞" value={priceMax} onChange={e => setPriceMax(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* Results header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
              {t("results", { count: filtered.length })}
            </p>
            <div className="relative">
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="appearance-none pl-7 pr-6 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
              >
                <option value="name_asc">{t("sortNameAsc")}</option>
                <option value="name_desc">{t("sortNameDesc")}</option>
                <option value="price_desc">{t("sortPriceDesc")}</option>
                <option value="price_asc">{t("sortPriceAsc")}</option>
                <option value="stock_desc">{t("sortStockDesc")}</option>
                <option value="stock_asc">{t("sortStockAsc")}</option>
              </select>
              <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {tableHeader}

            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Package className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">{products.length === 0 ? t("empty") : t("noResults")}</p>
                {canManage && products.length === 0 && (
                  <button onClick={openNew} className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                    <Plus className="w-3.5 h-3.5" /> {t("newProduct")}
                  </button>
                )}
                {activeCount > 0 && products.length > 0 && (
                  <button onClick={clearAll} className="text-xs text-primary hover:underline">{t("clearFilters")}</button>
                )}
              </div>
            ) : groups ? (
              <div>
                {groups.map(g => (
                  <div key={g.key}>
                    <div className="flex items-center justify-between px-5 py-2 bg-muted/40 border-b border-border">
                      <span className="text-xs font-semibold text-foreground">{g.label}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{g.items.length}</span>
                    </div>
                    <div className="divide-y divide-border/60">
                      {g.items.map(renderRow)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filtered.map(renderRow)}
              </div>
            )}
          </div>
        </div>
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

function FilterRow({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-3.5 h-3.5 rounded accent-primary shrink-0" />
      <span className="text-sm text-foreground group-hover:text-primary transition-colors flex-1 min-w-0 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] tabular-nums text-muted-foreground/60 shrink-0">{count}</span>
      )}
    </label>
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
