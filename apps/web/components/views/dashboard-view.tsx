"use client"

import { useState, useMemo } from "react"
import {
  FileText, Receipt, Package, FolderOpen,
  TrendingUp, Clock, CheckCircle2, AlertCircle,
  MoreHorizontal, ChevronRight, Plus, Search, Building2, X,
  Euro, ArrowUpRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"
import { useOverdueDocs } from "@/lib/hooks/use-overdue-docs"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import type { DocumentStatus, DocumentType } from "@/lib/supabase/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

const STATUS_STYLES: Record<DocumentStatus, string> = {
  paid:      "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  pending:   "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  overdue:   "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
  draft:     "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
}

const TYPE_STYLES: Record<string, string> = {
  invoice_issued:   "bg-accent/10 text-accent",
  invoice_received: "bg-primary/10 text-primary",
  delivery_note:    "bg-primary/10 text-primary",
  receipt:          "bg-secondary-foreground/10 text-muted-foreground",
  order:            "bg-blue-100/50 text-blue-600",
}

export function DashboardView() {
  const t = useTranslations("dashboard")
  const tDoc = useTranslations("documents")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const [searchQuery, setSearchQuery] = useState("")
  const [dismissedOverdue, setDismissedOverdue] = useState(false)
  const { currentOrg, userProfile, loading: orgLoading } = useOrganization()
  const { documents, loading: docsLoading } = useDocuments(currentOrg?.id ?? null)
  const { overdueDocs, overdueCount } = useOverdueDocs(currentOrg?.id ?? null)

  const loading = orgLoading || docsLoading

  const recentDocs = documents.slice(0, 6)

  const kpis = useMemo(() => {
    const sum = (pred: (d: typeof documents[0]) => boolean) =>
      documents.filter(pred).reduce((acc, d) => acc + (d.total ?? 0), 0)

    const paidAmount    = sum(d => d.status === "paid")
    const pendingAmount = sum(d => d.status === "pending")
    const overdueAmount = sum(d => d.status === "overdue")
    const totalDocs     = documents.length

    const fmt = (n: number) =>
      n >= 1_000_000
        ? `${(n / 1_000_000).toFixed(1)}M €`
        : n >= 10_000
        ? `${(n / 1_000).toFixed(1)}k €`
        : n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"

    return [
      {
        label: t("stats.totalDocuments"),
        value: String(totalDocs),
        sub: `${documents.filter(d => {
          if (!d.issue_date) return false
          const m = new Date(d.issue_date).getMonth()
          return m === new Date().getMonth()
        }).length} este mes`,
        icon: FolderOpen,
        iconBg: "bg-primary/10",
        iconColor: "text-primary",
        isAmount: false,
      },
      {
        label: "Cobrado",
        value: fmt(paidAmount),
        sub: `${documents.filter(d => d.status === "paid").length} docs pagados`,
        icon: CheckCircle2,
        iconBg: "bg-[var(--status-paid)]/10",
        iconColor: "text-[var(--status-paid)]",
        isAmount: true,
      },
      {
        label: "Pendiente de cobro",
        value: fmt(pendingAmount),
        sub: `${documents.filter(d => d.status === "pending").length} docs pendientes`,
        icon: Clock,
        iconBg: "bg-[var(--status-pending)]/10",
        iconColor: "text-[var(--status-pending)]",
        isAmount: true,
      },
      {
        label: "Vencido",
        value: fmt(overdueAmount),
        sub: `${documents.filter(d => d.status === "overdue").length} docs vencidos`,
        icon: AlertCircle,
        iconBg: "bg-[var(--status-overdue)]/10",
        iconColor: "text-[var(--status-overdue)]",
        isAmount: true,
      },
    ]
  }, [documents, locale])

  const paidCount        = documents.filter(d => d.status === "paid").length
  const pendingCount     = documents.filter(d => d.status === "pending").length
  const overdueBarCount  = documents.filter(d => d.status === "overdue").length
  const total = paidCount + pendingCount + overdueBarCount || 1

  const amountByStatus = useMemo(() => {
    const sum = (status: string) =>
      documents.filter(d => d.status === status).reduce((acc, d) => acc + (d.total ?? 0), 0)
    return { paid: sum("paid"), pending: sum("pending"), overdue: sum("overdue") }
  }, [documents])

  const firstName = userProfile?.first_name ?? ""

  const monthlyData = loading ? [] : (() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const year = d.getFullYear()
      const month = d.getMonth()
      const count = documents.filter(doc => {
        if (!doc.issue_date) return false
        const dd = new Date(doc.issue_date)
        return dd.getFullYear() === year && dd.getMonth() === month
      }).length
      return {
        month: d.toLocaleDateString(locale, { month: "short" }),
        docs: count,
      }
    })
  })()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {firstName ? t("welcome", { name: firstName }) : t("title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={tCommon("search")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          <Link
            href="/empresas"
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Nueva empresa
          </Link>
          <Link
            href="/subir"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("newDocument")}
          </Link>
        </div>
      </div>

      {/* Overdue alert banner */}
      {overdueCount > 0 && !dismissedOverdue && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3.5 bg-[var(--status-overdue)]/8 border border-[var(--status-overdue)]/25 rounded-xl">
          <AlertCircle className="w-4 h-4 text-[var(--status-overdue)] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {overdueCount} documento{overdueCount > 1 ? "s" : ""} vencido{overdueCount > 1 ? "s" : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {overdueDocs.slice(0, 3).map(doc => (
                <Link
                  key={doc.id}
                  href={`/factura/${doc.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {doc.document_number ?? doc.id.slice(0, 8)}
                  {doc.due_date && (
                    <span className="text-[var(--status-overdue)] ml-1">
                      · {new Date(doc.due_date).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    </span>
                  )}
                </Link>
              ))}
              {overdueCount > 3 && (
                <Link href="/biblioteca?status=overdue" className="text-xs text-accent hover:underline">
                  +{overdueCount - 3} más →
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/biblioteca?status=overdue"
              className="text-xs font-medium text-[var(--status-overdue)] hover:underline"
            >
              Ver todos
            </Link>
            <button
              onClick={() => setDismissedOverdue(true)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {kpis.map(kpi => (
              <div key={kpi.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">{kpi.label}</span>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", kpi.iconBg)}>
                    <kpi.icon className={cn("w-4 h-4", kpi.iconColor)} />
                  </div>
                </div>
                <div>
                  <p className={cn("font-bold text-foreground leading-none", kpi.isAmount ? "text-2xl" : "text-3xl")}>
                    {kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">{kpi.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Recent Documents */}
            <div className="col-span-2 bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground text-sm">{t("recentDocuments")}</h2>
                <Link href="/biblioteca" className="text-xs text-accent hover:underline flex items-center gap-1">
                  {tCommon("viewAll")} <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {recentDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Sin documentos todavía</p>
                    <p className="text-xs text-muted-foreground mt-1">Sube tu primer documento para empezar</p>
                  </div>
                  <Link href="/subir"
                    className="mt-1 flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Subir documento
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors group cursor-pointer">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.document_number ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString(locale) : "—"}
                        </p>
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TYPE_STYLES[doc.document_type] ?? "bg-muted text-muted-foreground")}>
                        {tDoc(`types.${doc.document_type}`)}
                      </span>
                      <span className="text-sm font-semibold text-foreground w-28 text-right">
                        {doc.total != null ? `${doc.total.toLocaleString("en", { minimumFractionDigits: 2 })} €` : "—"}
                      </span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium w-20 text-center", STATUS_STYLES[doc.status])}>
                        {tDoc(`statuses.${doc.status}`)}
                      </span>
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-5">
              {/* Onboarding checklist — visible until dismissed or completed */}
              <OnboardingChecklist orgId={currentOrg?.id ?? null} />

              {/* Invoice Status */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-foreground text-sm mb-4">{t("invoiceStatus")}</h2>
                <div className="space-y-3">
                  {[
                    { key: "paid" as DocumentStatus,    icon: CheckCircle2, color: "text-[var(--status-paid)]",    bar: "bg-[var(--status-paid)]",    count: paidCount,       pct: Math.round((paidCount / total) * 100),       amount: amountByStatus.paid },
                    { key: "pending" as DocumentStatus, icon: Clock,        color: "text-[var(--status-pending)]", bar: "bg-[var(--status-pending)]", count: pendingCount,    pct: Math.round((pendingCount / total) * 100),    amount: amountByStatus.pending },
                    { key: "overdue" as DocumentStatus, icon: AlertCircle,  color: "text-[var(--status-overdue)]", bar: "bg-[var(--status-overdue)]", count: overdueBarCount, pct: Math.round((overdueBarCount / total) * 100), amount: amountByStatus.overdue },
                  ].map(item => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <item.icon className={cn("w-3.5 h-3.5", item.color)} />
                          <span className="text-sm text-foreground">{tDoc(`statuses.${item.key}`)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-foreground block leading-none">
                            {item.amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </span>
                          <span className="text-[10px] text-muted-foreground">{item.count} docs</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", item.bar)} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick links */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-foreground text-sm mb-3">{t("quickLinks")}</h2>
                <div className="space-y-1">
                  {[
                    { label: t("links.todaysInvoices"),   href: "/biblioteca?type=invoice_issued&date=today" },
                    { label: t("links.pendingPayments"),  href: "/biblioteca?status=pending" },
                    { label: t("links.activeCompanies"),  href: "/empresas" },
                    { label: t("links.advancedSearch"),   href: "/buscador" },
                  ].map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/60 text-sm text-foreground transition-colors"
                    >
                      {link.label}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Activity Chart */}
          <div className="mt-6 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground text-sm">{t("monthlyActivity")}</h2>
              <span className="text-xs text-muted-foreground">{t("last6Months")}</span>
            </div>
            {monthlyData.every(m => m.docs === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <TrendingUp className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Sin actividad registrada todavía</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthlyData} barSize={28} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                    itemStyle={{ color: "hsl(var(--muted-foreground))" }}
                    formatter={(v: number) => [v, t("stats.totalDocuments")]}
                  />
                  <Bar dataKey="docs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  )
}
