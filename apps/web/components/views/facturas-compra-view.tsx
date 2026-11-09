"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { Plus, Search, ShoppingCart, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"
import { useAccessContext } from "@/lib/hooks/use-access"
import { canAccess } from "@/lib/permissions"
import { isExpenseDoc } from "@/lib/document-flow"
import type { DocumentStatus } from "@/lib/supabase/types"

const STATUS_STYLES: Record<DocumentStatus, string> = {
  paid:      "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  pending:   "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  overdue:   "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
  draft:     "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
}

/**
 * Facturas de compra: las facturas recibidas de proveedores. Son gasto, así
 * que su estado es «pagada / pendiente de pago», nunca «cobrada». Se dan de
 * alta con el mismo formulario de subida, con el tipo ya elegido.
 */
export function FacturasCompraView() {
  const t = useTranslations("purchaseInvoices")
  const tStatus = useTranslations("documents.statuses")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const { currentOrg } = useOrganization()
  const { documents, loading } = useDocuments(currentOrg?.id ?? null)
  const { ctx } = useAccessContext()
  const canUpload = canAccess("subir", ctx)
  const [search, setSearch] = useState("")

  const purchases = useMemo(() => documents.filter(isExpenseDoc), [documents])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? purchases.filter(d =>
          (d.document_number ?? "").toLowerCase().includes(q) ||
          (d.company?.name ?? "").toLowerCase().includes(q))
      : purchases
    return [...list].sort((a, b) => (b.issue_date ?? b.created_at).localeCompare(a.issue_date ?? a.created_at))
  }, [purchases, search])

  const fmt = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
  const sum = (status: DocumentStatus) =>
    purchases.filter(d => d.status === status).reduce((acc, d) => acc + (d.total ?? 0), 0)
  const count = (status: DocumentStatus) => purchases.filter(d => d.status === status).length

  const cards = [
    { label: t("paid"),    status: "paid" as const,    icon: CheckCircle2, color: "text-[var(--status-paid)]" },
    { label: t("pending"), status: "pending" as const, icon: Clock,        color: "text-[var(--status-pending)]" },
    { label: t("overdue"), status: "overdue" as const, icon: AlertCircle,  color: "text-[var(--status-overdue)]" },
  ]

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
        </div>
        {canUpload && (
          <Link
            href="/subir?type=invoice_received"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors self-start"
          >
            <Plus className="w-4 h-4" />
            {t("new")}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.status} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{c.label}</span>
              <c.icon className={cn("w-4 h-4", c.color)} />
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight mt-2 tabular-nums">{fmt(sum(c.status))}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">{t("count", { count: count(c.status) })}</p>
          </div>
        ))}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={tCommon("search")}
          className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/40 placeholder:text-muted-foreground/50"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-16 px-6 text-center">
          <ShoppingCart className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">{search.trim() ? t("noResults") : t("empty")}</p>
          {!search.trim() && <p className="text-xs text-muted-foreground mt-1">{t("emptyHint")}</p>}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 border-b border-border">
                <th className="px-5 py-3 font-semibold">{t("columns.number")}</th>
                <th className="px-5 py-3 font-semibold">{t("columns.supplier")}</th>
                <th className="px-5 py-3 font-semibold">{t("columns.date")}</th>
                <th className="px-5 py-3 font-semibold text-right">{t("columns.total")}</th>
                <th className="px-5 py-3 font-semibold">{t("columns.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(d => (
                <tr key={d.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/factura/${d.id}`} className="text-foreground hover:underline">
                      {d.document_number || "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{d.company?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">
                    {d.issue_date ? new Date(`${d.issue_date}T00:00:00`).toLocaleDateString(locale) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">{fmt(d.total ?? 0)}</td>
                  <td className="px-5 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_STYLES[d.status])}>
                      {tStatus(d.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
