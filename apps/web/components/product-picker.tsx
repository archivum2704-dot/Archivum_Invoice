"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/hooks/use-products"

const inputCls = "w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"

// Type-to-search product picker for invoice lines (matches by name or SKU).
// Picking a product fills the line via pickProduct; picking "manual" unlinks it.
export function ProductPicker({ products, value, onPick }: {
  products: Product[]
  value: string | null
  onPick: (id: string | null) => void
}) {
  const t = useTranslations("invoicing")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = products.find(p => p.id === value)

  const q = query.trim().toLowerCase()
  const matches = q
    ? products.filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q))
    : products

  const pick = (id: string | null) => { onPick(id); setOpen(false); setQuery("") }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={open ? query : (selected?.name ?? "")}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(""); setOpen(true) }}
        onBlur={() => setOpen(false)}
        placeholder={selected ? selected.name : t("searchProduct")}
        className={cn(inputCls, "py-1.5 text-xs pl-8")}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-44 overflow-y-auto bg-card border border-border rounded-lg shadow-lg">
          {/* onMouseDown so picks fire before the input's onBlur closes the list */}
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); pick(null) }}
            className={cn(
              "w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted transition-colors",
              !value && "bg-primary/5 font-medium"
            )}
          >
            {t("manualLine")}
          </button>
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t("noProductMatches")}</p>
          ) : matches.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(p.id) }}
              className={cn(
                "flex items-center justify-between gap-2 w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors",
                p.id === value && "bg-primary/5 font-medium"
              )}
            >
              <span className="truncate text-foreground">{p.name}</span>
              {p.sku && <span className="shrink-0 text-[10px] text-muted-foreground">{p.sku}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
