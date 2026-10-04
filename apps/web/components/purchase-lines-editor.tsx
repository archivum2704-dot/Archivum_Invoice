"use client"

import { useState } from "react"
import { Plus, Trash2, PackagePlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { useProducts } from "@/lib/hooks/use-products"
import { isPaidPlan } from "@/lib/plan"
import { ProductFormModal } from "@/components/product-form-modal"
import { ProductPicker } from "@/components/product-picker"
import {
  type PurchaseLine, emptyPurchaseLine, lineBase, purchaseTotals,
} from "@/lib/purchase-lines"

const inputCls = "w-full px-2.5 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
const numCls = cn(inputCls, "text-right tabular-nums")

const fmt = (n: number, currency: string) =>
  `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`

/**
 * Líneas de una factura de compra. Cada línea puede ir enlazada a un producto
 * del inventario; al guardar la factura, la base de datos suma su cantidad al
 * stock (ver lib/purchase-lines.ts). Lo usan Subir y Editar.
 */
export function PurchaseLinesEditor({ lines, onChange, currency, disabled }: {
  lines: PurchaseLine[]
  onChange: (lines: PurchaseLine[]) => void
  currency: string
  disabled?: boolean
}) {
  const t = useTranslations("purchaseLines")
  const { currentOrg, isOrgAdmin, isPlatformAdmin } = useOrganization()
  const { products, mutate: mutateProducts } = useProducts(currentOrg?.id ?? null)
  const canCreateProduct = isOrgAdmin && (isPaidPlan(currentOrg) || isPlatformAdmin)
  const [productModalLine, setProductModalLine] = useState<number | null>(null)

  const setLine = (i: number, patch: Partial<PurchaseLine>) =>
    onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const pickProduct = (i: number, id: string | null) => {
    if (!id) { setLine(i, { productId: null }); return }
    const p = products.find(pr => pr.id === id)
    if (!p) return
    // El precio del producto es el de VENTA; el de compra lo pone el proveedor,
    // así que solo se rellena la descripción y el IVA.
    setLine(i, { productId: p.id, description: p.name, taxRate: String(Number(p.tax_rate)) })
  }

  const totals = purchaseTotals(lines)
  const tracked = (id: string | null) => !!id && !!products.find(p => p.id === id)?.track_stock

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{t("hint")}</p>

      {lines.length > 0 && (
        <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_70px_100px_70px_100px_28px] gap-2 px-1 mb-1.5 text-[11px] font-medium text-muted-foreground">
          <span>{t("product")}</span>
          <span>{t("description")}</span>
          <span className="text-right">{t("quantity")}</span>
          <span className="text-right">{t("unitCost")}</span>
          <span className="text-right">{t("vat")}</span>
          <span className="text-right">{t("lineTotal")}</span>
          <span />
        </div>
      )}

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_70px_100px_70px_100px_28px] gap-2 items-start p-2 md:p-1 rounded-lg border md:border-0 border-border">
            <div className="col-span-2 md:col-span-1 flex flex-col gap-1">
              {disabled
                ? <span className="text-sm py-1.5">{products.find(p => p.id === l.productId)?.name ?? "—"}</span>
                : <ProductPicker products={products} value={l.productId} onPick={id => pickProduct(i, id)} />}
              {!disabled && (l.productId ? (
                <span className="text-[11px] text-muted-foreground">
                  {tracked(l.productId) ? t("addsStock") : t("noStockTracking")}
                </span>
              ) : canCreateProduct && (
                <button type="button" onClick={() => setProductModalLine(i)}
                  className="self-start flex items-center gap-1 text-[11px] text-accent hover:underline">
                  <PackagePlus className="w-3 h-3" /> {t("newProduct")}
                </button>
              ))}
            </div>
            <input className={cn(inputCls, "col-span-2 md:col-span-1")} placeholder={t("description")} value={l.description}
              disabled={disabled} onChange={e => setLine(i, { description: e.target.value })} />
            <input className={numCls} inputMode="decimal" title={t("quantity")} placeholder="1" value={l.quantity}
              disabled={disabled} onChange={e => setLine(i, { quantity: e.target.value })} />
            <input className={numCls} inputMode="decimal" title={t("unitCost")} placeholder="0,00" value={l.unitPrice}
              disabled={disabled} onChange={e => setLine(i, { unitPrice: e.target.value })} />
            <select className={numCls} title={t("vat")} value={l.taxRate} disabled={disabled}
              onChange={e => setLine(i, { taxRate: e.target.value })}>
              {["0", "4", "5", "10", "21"].map(v => <option key={v} value={v}>{v}%</option>)}
            </select>
            <span className="text-sm text-right tabular-nums py-1.5 font-medium">{fmt(lineBase(l), currency)}</span>
            {!disabled && (
              <button type="button" title={t("removeLine")} onClick={() => onChange(lines.filter((_, j) => j !== i))}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors justify-self-end">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <button type="button" onClick={() => onChange([...lines, emptyPurchaseLine()])}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
          <Plus className="w-3.5 h-3.5" /> {t("addLine")}
        </button>
      )}

      {lines.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border flex flex-col items-end gap-1 text-sm">
          <div className="flex gap-6"><span className="text-muted-foreground">{t("subtotal")}</span><span className="tabular-nums w-32 text-right">{fmt(totals.subtotal, currency)}</span></div>
          <div className="flex gap-6"><span className="text-muted-foreground">{t("vatTotal")}</span><span className="tabular-nums w-32 text-right">{fmt(totals.tax, currency)}</span></div>
          <div className="flex gap-6 font-semibold"><span>{t("total")}</span><span className="tabular-nums w-32 text-right">{fmt(totals.total, currency)}</span></div>
        </div>
      )}

      {productModalLine != null && currentOrg && (
        <ProductFormModal
          orgId={currentOrg.id}
          products={products}
          initial={{
            name: lines[productModalLine]?.description.trim() ?? "",
            tax_rate: lines[productModalLine]?.taxRate || "21",
          }}
          onSaved={async (id) => {
            const fresh = await mutateProducts()
            const p = (fresh ?? products).find(pr => pr.id === id)
            if (p) setLine(productModalLine, {
              productId: p.id,
              description: lines[productModalLine]?.description.trim() || p.name,
              taxRate: String(Number(p.tax_rate)),
            })
          }}
          onClose={() => setProductModalLine(null)}
        />
      )}
    </div>
  )
}
