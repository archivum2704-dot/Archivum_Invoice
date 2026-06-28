"use client"

import { useState, useMemo } from "react"
import {
  FileText, Users, Clock, CheckCircle2, AlertCircle,
  TrendingUp, TrendingDown, ChevronRight, Plus, Search, Building2, X, FolderOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"
import { useCompanies } from "@/lib/hooks/use-companies"
import { useOverdueDocs } from "@/lib/hooks/use-overdue-docs"
import { OnboardingChecklist } from "@/components/onboarding-checklist"
import type { DocumentStatus } from "@/lib/supabase/types"
import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts"

// Traffic-light dot colour by document status
const DOT_COLORS: Record<DocumentStatus, string> = {
  paid:      "bg-[var(--status-paid)]",
  pending:   "bg-[var(--status-pending)]",
  overdue:   "bg-[var(--status-overdue)]",
  draft:     "bg-muted-foreground/40",
  cancelled: "bg-muted-foreground/40",
}

export function DashboardView() {
  const t = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const [searchQuery, setSearchQuery] = useState("")
  const [dismissedOverdue, setDismissedOverdue] = useState(false)

  const { currentOrg, userProfile, loading: orgLoading } = useOrganization()
  const { documents, loading: docsLoading } = useDocuments(currentOrg?.id ?? null)
  const { companies, loading: companiesLoading } = useCompanies(currentOrg?.id ?? null)
  const { overdueDocs, overdueCount } = useOverdueDocs(currentOrg?.id ?? null)

  const loading = orgLoading || docsLoading || companiesLoading

  const firstName = userProfile?.first_name ?? ""

  const fmtEur = (n: number) => `${n.toLocaleString(locale, { maximumFractionDigits: 0 })} €`

  // Amounts by status
  const { paidAmount, pendingAmount } = useMemo(() => {
    const sum = (status: DocumentStatus) =>
      documents.filter(d => d.status === status).reduce((acc, d) => acc + (d.total ?? 0), 0)
    return { paidAmount: sum("paid"), pendingAmount: sum("pending") }
  }, [documents])

  // Revenue invoiced per month over the last 6 months
  const monthlyRevenue = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const year = d.getFullYear()
      const month = d.getMonth()
      const value = documents.reduce((acc, doc) => {
        if (!doc.issue_date) return acc
        const parts = doc.issue_date.split("-")
        if (parts.length !== 3) return acc
        const docYear = parseInt(parts[0], 10)
        const docMonth = parseInt(parts[1], 10) - 1
        if (docYear === year && docMonth === month) return acc + (doc.total ?? 0)
        return acc
      }, 0)
      return { month: d.toLocaleDateString(locale, { month: "short" }), value }
    })
  }, [documents, locale])

  const thisMonthRevenue = monthlyRevenue[5]?.value ?? 0
  const lastMonthRevenue = monthlyRevenue[4]?.value ?? 0
  const pctChange =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : thisMonthRevenue > 0 ? 100 : 0
  const trendUp = pctChange >= 0
  const hasRevenue = monthlyRevenue.some(m => m.value > 0)

  const stats = [
    { label: t("stats.invoices"), value: String(documents.length),  icon: FileText,     iconBg: "bg-primary/10",                iconColor: "text-primary" },
    { label: t("clients"),        value: String(companies.length),  icon: Users,        iconBg: "bg-accent/10",                 iconColor: "text-accent" },
    { label: t("kpi.collected"),  value: fmtEur(paidAmount),        icon: CheckCircle2, iconBg: "bg-[var(--status-paid)]/10",    iconColor: "text-[var(--status-paid)]" },
    { label: t("pendingShort"),   value: fmtEur(pendingAmount),     icon: Clock,        iconBg: "bg-[var(--status-pending)]/10", iconColor: "text-[var(--status-pending)]" },
  ]

  const recentDocs = documents.slice(0, 5)

  const barColor = typeof window !== "undefined"
    ? getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
    : "oklch(0.28 0.08 255)"

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-slide-up-fade">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
            {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {firstName ? t("welcome", { name: firstName }) : t("title")}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input
              type="text"
              placeholder={tCommon("search")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-xl w-44 sm:w-56 focus:outline-none focus:ring-2 focus:ring-ring/40 placeholder:text-muted-foreground/50 transition-all duration-200"
            />
          </div>
          <Link
            href="/empresas"
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted transition-all duration-200"
          >
            <Building2 className="w-3.5 h-3.5" />
            {tCommon("newCompany")}
          </Link>
          <Link
            href="/subir"
            className="group flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            <span className="w-5 h-5 rounded-lg bg-primary-foreground/15 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
              <Plus className="w-3 h-3" />
            </span>
            <span className="hidden sm:inline">{t("newDocument")}</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        </div>
      </div>

      {/* Overdue alert banner */}
      {overdueCount > 0 && !dismissedOverdue && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3.5 bg-[var(--status-overdue)]/8 border border-[var(--status-overdue)]/25 rounded-2xl animate-slide-up-fade">
          <AlertCircle className="w-4 h-4 text-[var(--status-overdue)] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {overdueCount} documento{overdueCount > 1 ? "s" : ""} vencido{overdueCount > 1 ? "s" : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {overdueDocs.slice(0, 3).map(doc => (
                <Link key={doc.id} href={`/factura/${doc.id}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {doc.document_number ?? doc.id.slice(0, 8)}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/biblioteca?status=overdue" className="text-xs font-medium text-[var(--status-overdue)] hover:underline">
              Ver todos
            </Link>
            <button onClick={() => setDismissedOverdue(true)} className="p-1 rounded hover:bg-muted transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Onboarding checklist — auto-hides when completed or dismissed */}
      <div className="mb-6">
        <OnboardingChecklist orgId={currentOrg?.id ?? null} />
      </div>

      {loading ? (
        /* ── Skeleton ─────────────────────────────────────── */
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-9 w-40" />
            <div className="skeleton h-12 w-full" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="skeleton w-8 h-8 rounded-lg" style={{ borderRadius: 8 }} />
                <div className="skeleton h-6 w-20" />
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Monthly revenue hero ──────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-6 animate-slide-up-fade" style={{ animationDelay: "80ms" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {t("monthlyRevenue")}
                </span>
                <p className="text-[2.4rem] leading-none font-bold tracking-tight text-foreground mt-2">
                  {fmtEur(thisMonthRevenue)}
                </p>
              </div>
              {hasRevenue && (
                <div className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0",
                  trendUp ? "bg-[var(--status-paid)]/10 text-[var(--status-paid)]" : "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]"
                )}>
                  {trendUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {trendUp ? "+" : ""}{pctChange}%
                </div>
              )}
            </div>

            {hasRevenue ? (
              <div className="mt-5 h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue} barSize={26} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {monthlyRevenue.map((_, i) => (
                        <Cell key={i} fill={barColor} fillOpacity={i === 5 ? 1 : 0.25} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-3">{t("vsLastMonth")}</p>
            )}
          </div>

          {/* ── Stat cards ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 animate-slide-up-fade"
                style={{ animationDelay: `${140 + i * 60}ms` }}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.iconBg)}>
                  <s.icon className={cn("w-4 h-4", s.iconColor)} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground tracking-tight leading-none">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1.5 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Recent invoices ────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden animate-slide-up-fade" style={{ animationDelay: "380ms" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground text-sm">{t("recentInvoices")}</h2>
              <Link href="/biblioteca" className="text-xs text-accent hover:underline flex items-center gap-1 font-medium">
                {tCommon("viewAll")} <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {recentDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{t("noDocumentsYet")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("noDocumentsHint")}</p>
                </div>
                <Link href="/subir" className="mt-1 flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                  <Plus className="w-3.5 h-3.5" /> {tCommon("uploadDocument")}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentDocs.map((doc, idx) => (
                  <Link
                    key={doc.id}
                    href={`/factura/${doc.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group animate-slide-up-fade"
                    style={{ animationDelay: `${440 + idx * 50}ms` }}
                  >
                    {/* Traffic-light status dot */}
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", DOT_COLORS[doc.status])} />

                    {/* Number */}
                    <span className="text-sm font-semibold text-foreground w-24 shrink-0 truncate">
                      {doc.document_number ?? "—"}
                    </span>

                    {/* Company */}
                    <span className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
                      {doc.company?.name ?? t("noCompany")}
                    </span>

                    {/* Amount */}
                    <span className="text-sm font-semibold text-foreground text-right shrink-0">
                      {doc.total != null ? fmtEur(doc.total) : "—"}
                    </span>

                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
