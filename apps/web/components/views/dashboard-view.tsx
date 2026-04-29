"use client"

import { useState } from "react"
import {
  FileText, Receipt, Package, FolderOpen,
  TrendingUp, Clock, CheckCircle2, AlertCircle,
  MoreHorizontal, ChevronRight, Plus, Search, Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"
import type { DocumentStatus, DocumentType } from "@/lib/supabase/types"

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
  const [searchQuery, setSearchQuery] = useState("")
  const { currentOrg, userProfile, loading: orgLoading } = useOrganization()
  const { documents, loading: docsLoading } = useDocuments(currentOrg?.id ?? null)

  const loading = orgLoading || docsLoading

  const stats = loading ? [] : [
    {
      label: t("stats.totalDocuments"),
      value: documents.length,
      delta: t("stats.thisMonth"),
      icon: FolderOpen,
      color: "text-primary",
    },
    {
      label: t("stats.invoices"),
      value: documents.filter(d => d.document_type === "invoice_issued" || d.document_type === "invoice_received").length,
      delta: t("stats.thisMonth"),
      icon: FileText,
      color: "text-accent",
    },
    {
      label: t("stats.deliveryNotes"),
      value: documents.filter(d => d.document_type === "delivery_note").length,
      delta: t("stats.thisMonth"),
      icon: Package,
      color: "text-[var(--status-paid)]",
    },
    {
      label: t("stats.receipts"),
      value: documents.filter(d => d.document_type === "receipt").length,
      delta: t("stats.thisMonth"),
      icon: Receipt,
      color: "text-[var(--status-pending)]",
    },
  ]

  const recentDocs = documents.slice(0, 6)

  const paidCount    = documents.filter(d => d.status === "paid").length
  const pendingCount = documents.filter(d => d.status === "pending").length
  const overdueCount = documents.filter(d => d.status === "overdue").length
  const total = paidCount + pendingCount + overdueCount || 1

  const firstName = userProfile?.first_name ?? ""

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {firstName ? t("welcome", { name: firstName }) : t("title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {stats.map(stat => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">{stat.label}</span>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-[var(--status-paid)]" />
                    {stat.delta}
                  </p>
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
                <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                  {tCommon("noResults")}
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
                          {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString("en") : "—"}
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
              {/* Invoice Status */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-foreground text-sm mb-4">{t("invoiceStatus")}</h2>
                <div className="space-y-3">
                  {[
                    { key: "paid" as DocumentStatus,    icon: CheckCircle2, color: "text-[var(--status-paid)]",    bar: "bg-[var(--status-paid)]",    count: paidCount,    pct: Math.round((paidCount / total) * 100) },
                    { key: "pending" as DocumentStatus, icon: Clock,        color: "text-[var(--status-pending)]", bar: "bg-[var(--status-pending)]", count: pendingCount, pct: Math.round((pendingCount / total) * 100) },
                    { key: "overdue" as DocumentStatus, icon: AlertCircle,  color: "text-[var(--status-overdue)]", bar: "bg-[var(--status-overdue)]", count: overdueCount, pct: Math.round((overdueCount / total) * 100) },
                  ].map(item => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <item.icon className={cn("w-3.5 h-3.5", item.color)} />
                          <span className="text-sm text-foreground">{tDoc(`statuses.${item.key}`)}</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">{item.count}</span>
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
        </>
      )}
    </div>
  )
}
