"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import {
  Search, SlidersHorizontal, FileText, Package, Receipt,
  CalendarDays, Tag, X, ChevronRight, ArrowUpDown, FolderOpen,
  FileSpreadsheet, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"
import { downloadCSV, downloadExcel } from "@/lib/utils/export"

const TYPE_ICONS: Record<string, React.ElementType> = {
  invoice_issued:   FileText,
  invoice_received: FileText,
  delivery_note:    Package,
  receipt:          Receipt,
  order:            FolderOpen,
}

const TYPE_STYLES: Record<string, string> = {
  invoice_issued:   "bg-accent/10 text-accent",
  invoice_received: "bg-primary/10 text-primary",
  delivery_note:    "bg-primary/10 text-primary",
  receipt:          "bg-muted text-muted-foreground",
  order:            "bg-blue-100/50 text-blue-600",
}

const STATUS_STYLES: Record<string, string> = {
  paid:      "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  pending:   "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  overdue:   "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
  draft:     "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
}

const DOC_TYPES    = ["invoice_issued", "invoice_received", "delivery_note", "receipt", "order"] as const
const DOC_STATUSES = ["paid", "pending", "overdue", "draft", "cancelled"] as const

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc"

export function BuscadorView() {
  const t         = useTranslations("documents.search")
  const tTypes    = useTranslations("documents.types")
  const tStatuses = useTranslations("documents.statuses")
  const tExport   = useTranslations("documents.export")
  const tFields   = useTranslations("documents.fields")
  const locale    = useLocale()

  const [query,            setQuery]            = useState("")
  const [selectedTypes,    setSelectedTypes]    = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [dateFrom,         setDateFrom]         = useState("")
  const [dateTo,           setDateTo]           = useState("")
  const [amountMin,        setAmountMin]        = useState("")
  const [amountMax,        setAmountMax]        = useState("")
  const [sortKey,          setSortKey]          = useState<SortKey>("date_desc")
  const [showExportMenu,   setShowExportMenu]   = useState(false)

  const exportRef = useRef<HTMLDivElement>(null)

  const { currentOrg } = useOrganization()
  const { documents, loading } = useDocuments(currentOrg?.id ?? null)

  // Close export dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const toggle = (arr: string[], setArr: (a: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])

  const clearAll = () => {
    setQuery(""); setSelectedTypes([]); setSelectedStatuses([])
    setDateFrom(""); setDateTo(""); setAmountMin(""); setAmountMax("")
  }

  const activeCount = selectedTypes.length + selectedStatuses.length
    + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)
    + (amountMin ? 1 : 0) + (amountMax ? 1 : 0)

  const results = useMemo(() => {
    const q    = query.toLowerCase().trim()
    const minA = amountMin ? parseFloat(amountMin.replace(",", ".")) : null
    const maxA = amountMax ? parseFloat(amountMax.replace(",", ".")) : null

    let filtered = documents.filter(d => {
      if (q) {
        const haystack = [
          d.document_number ?? "",
          d.company?.name   ?? "",
          d.notes           ?? "",
          d.description     ?? "",
        ].join(" ").toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (selectedTypes.length    && !selectedTypes.includes(d.document_type)) return false
      if (selectedStatuses.length && !selectedStatuses.includes(d.status))     return false
      if (dateFrom && d.issue_date && d.issue_date < dateFrom)  return false
      if (dateTo   && d.issue_date && d.issue_date > dateTo)    return false
      if (minA != null && (d.total ?? 0) < minA) return false
      if (maxA != null && (d.total ?? 0) > maxA) return false
      return true
    })

    filtered = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "date_asc":    return (a.issue_date ?? "").localeCompare(b.issue_date ?? "")
        case "date_desc":   return (b.issue_date ?? "").localeCompare(a.issue_date ?? "")
        case "amount_asc":  return (a.total ?? 0) - (b.total ?? 0)
        case "amount_desc": return (b.total ?? 0) - (a.total ?? 0)
      }
    })

    return filtered
  }, [documents, query, selectedTypes, selectedStatuses, dateFrom, dateTo, amountMin, amountMax, sortKey])

  const exportLabels = {
    number: tFields("number"),
    type: tFields("type"),
    company: tFields("company"),
    cif: "CIF/NIF",
    status: tFields("status"),
    subtotal: "Subtotal",
    taxRate: "% IVA",
    taxAmount: "Cuota IVA",
    total: tFields("amount"),
    currency: tExport("currency"),
    issueDate: tFields("issueDate"),
    dueDate: tFields("dueDate"),
    paymentDate: tFields("paymentDate"),
    description: tFields("description"),
    notes: tFields("notes"),
  }

  const orgSlug = currentOrg?.slug ?? "archivum"
  const today   = new Date().toISOString().slice(0, 10)

  const handleExportCSV = () => {
    downloadCSV(results, exportLabels, k => tTypes(k as any), k => tStatuses(k as any), `${orgSlug}_busqueda_${today}.csv`)
    setShowExportMenu(false)
  }
  const handleExportExcel = () => {
    downloadExcel(results, exportLabels, k => tTypes(k as any), k => tStatuses(k as any), `${orgSlug}_busqueda_${today}.xls`)
    setShowExportMenu(false)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
        </div>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={results.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {tExport("button")}
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", showExportMenu && "rotate-180")} />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden w-52">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs text-muted-foreground">{tExport("subtitle", { count: results.length })}</p>
              </div>
              <button onClick={handleExportCSV} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">CSV</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{tExport("csv")}</p>
                  <p className="text-xs text-muted-foreground">{tExport("csvHint")}</p>
                </div>
              </button>
              <button onClick={handleExportExcel} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left">
                <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">XLS</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{tExport("excel")}</p>
                  <p className="text-xs text-muted-foreground">{tExport("excelHint")}</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por número, empresa, notas…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-12 pr-10 py-3.5 text-base bg-card border-2 border-border rounded-xl focus:outline-none focus:border-primary placeholder:text-muted-foreground transition-colors"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Filters sidebar */}
        <aside className="w-60 shrink-0">
          <div className="bg-card border border-border rounded-xl p-4 sticky top-6 space-y-5">
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

            {/* Type */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("typeFilter")}</p>
              <div className="space-y-1.5">
                {DOC_TYPES.map(k => (
                  <label key={k} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={selectedTypes.includes(k)}
                      onChange={() => toggle(selectedTypes, setSelectedTypes, k)}
                      className="w-3.5 h-3.5 rounded accent-primary" />
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">{tTypes(k)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("statusFilter")}</p>
              <div className="space-y-1.5">
                {DOC_STATUSES.map(k => (
                  <label key={k} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={selectedStatuses.includes(k)}
                      onChange={() => toggle(selectedStatuses, setSelectedStatuses, k)}
                      className="w-3.5 h-3.5 rounded accent-primary" />
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">{tStatuses(k)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("dateFilter")}</p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Desde</p>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Hasta</p>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground" />
                </div>
              </div>
            </div>

            {/* Amount range */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Importe</p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mínimo (€)</p>
                  <input type="number" min="0" placeholder="0" value={amountMin} onChange={e => setAmountMin(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Máximo (€)</p>
                  <input type="number" min="0" placeholder="∞" value={amountMax} onChange={e => setAmountMax(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
              <p className="text-muted-foreground text-sm">{t("loading")}</p>
            </div>
          ) : (
            <>
              {/* Results header */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{results.length}</span>{" "}
                  resultado{results.length !== 1 ? "s" : ""}
                  {query && <span className="ml-1">para "<span className="text-foreground">{query}</span>"</span>}
                </p>
                <div className="relative">
                  <select
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value as SortKey)}
                    className="appearance-none pl-7 pr-6 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                  >
                    <option value="date_desc">Fecha ↓</option>
                    <option value="date_asc">Fecha ↑</option>
                    <option value="amount_desc">Importe ↓</option>
                    <option value="amount_asc">Importe ↑</option>
                  </select>
                  <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                      <Search className="w-7 h-7 text-muted-foreground/40" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("noResults")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("noResultsHint")}</p>
                    </div>
                    {activeCount > 0 && (
                      <button onClick={clearAll} className="text-xs text-primary hover:underline">
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {results.map(doc => {
                      const Icon = TYPE_ICONS[doc.document_type] ?? FileText
                      return (
                        <Link
                          href={`/factura/${doc.id}`}
                          key={doc.id}
                          className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">
                                {doc.document_number ?? doc.id.slice(0, 8).toUpperCase()}
                              </p>
                              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", TYPE_STYLES[doc.document_type] ?? "bg-muted text-muted-foreground")}>
                                {tTypes(doc.document_type as any)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {doc.company?.name ?? "—"}
                              {doc.notes && <span className="ml-2 opacity-60">· {doc.notes.slice(0, 50)}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-sm font-bold text-foreground">
                              {doc.total != null
                                ? doc.total.toLocaleString(locale, { minimumFractionDigits: 2 }) + " €"
                                : "—"}
                            </span>
                            <span className="text-xs text-muted-foreground w-24 text-right">
                              {doc.issue_date ? new Date(doc.issue_date).toLocaleDateString(locale) : "—"}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium w-20 text-center", STATUS_STYLES[doc.status] ?? "bg-muted text-muted-foreground")}>
                              {tStatuses(doc.status as any)}
                            </span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
