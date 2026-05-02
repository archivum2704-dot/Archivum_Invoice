"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  FileText, Package, Receipt, FolderOpen,
  Search, Filter, Grid3X3, List, Plus, Download, Eye, ChevronDown, FileSpreadsheet, Pencil,
  ChevronLeft, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"
import { downloadCSV, downloadExcel } from "@/lib/utils/export"

const TYPE_STYLES: Record<string, { icon: React.ElementType; className: string }> = {
  invoice_issued:   { icon: FileText,  className: "bg-accent/10 text-accent" },
  invoice_received: { icon: FileText,  className: "bg-primary/10 text-primary" },
  delivery_note:    { icon: Package,   className: "bg-primary/10 text-primary" },
  receipt:          { icon: Receipt,   className: "bg-secondary-foreground/10 text-muted-foreground" },
  order:            { icon: FolderOpen, className: "bg-blue-100/50 text-blue-600" },
}

const STATUS_STYLES: Record<string, string> = {
  paid:      "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  pending:   "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  overdue:   "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
  draft:     "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
}

const TAG_COLORS = ["bg-blue-100 text-blue-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-rose-100 text-rose-700"]

export function BibliotecaView() {
  const t = useTranslations("documents.library")
  const tTypes = useTranslations("documents.types")
  const tStatuses = useTranslations("documents.statuses")
  const tActions = useTranslations("documents.actions")
  const tFields = useTranslations("documents.fields")
  const tExport = useTranslations("documents.export")

  const PAGE_SIZE = 20

  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [page, setPage] = useState(1)
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
  const today = new Date().toISOString().slice(0, 10)

  const handleExportCSV = () => {
    downloadCSV(filtered, exportLabels, (k) => tTypes(k as any), (k) => tStatuses(k as any), `${orgSlug}_facturas_${today}.csv`)
    setShowExportMenu(false)
  }

  const handleExportExcel = () => {
    downloadExcel(filtered, exportLabels, (k) => tTypes(k as any), (k) => tStatuses(k as any), `${orgSlug}_facturas_${today}.xls`)
    setShowExportMenu(false)
  }

  const filtered = useMemo(() => documents.filter((d) => {
    const matchSearch =
      (d.document_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.company?.name ?? "").toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === "all" || d.document_type === filterType
    const matchStatus = filterStatus === "all" || d.status === filterStatus
    return matchSearch && matchType && matchStatus
  }), [documents, search, filterType, filterStatus])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, filterType, filterStatus])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const getTypeStyle = (type: string) => TYPE_STYLES[type] ?? { icon: FileText, className: "bg-muted text-muted-foreground" }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("found", { count: filtered.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {tExport("button")}
              <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", showExportMenu && "rotate-180")} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden w-52">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs text-muted-foreground">{tExport("subtitle", { count: filtered.length })}</p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                >
                  <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">CSV</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tExport("csv")}</p>
                    <p className="text-xs text-muted-foreground">{tExport("csvHint")}</p>
                  </div>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                >
                  <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">XLS</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tExport("excel")}</p>
                    <p className="text-xs text-muted-foreground">{tExport("excelHint")}</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <Link href="/subir" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />{t("uploadNew")}
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t("filters")}</span>
        </div>

        <div className="relative">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="appearance-none pl-3 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
            <option value="all">{t("all")}</option>
            {["invoice_issued","invoice_received","delivery_note","receipt","order"].map((k) => (
              <option key={k} value={k}>{tTypes(k as any)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="appearance-none pl-3 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
            <option value="all">{t("all")}</option>
            {["paid","pending","overdue","draft","cancelled"].map((k) => (
              <option key={k} value={k}>{tStatuses(k as any)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        <div className="flex items-center bg-card border border-border rounded-lg p-0.5 ml-auto">
          <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            {documents.length === 0
              ? <FolderOpen className="w-8 h-8 text-muted-foreground/50" />
              : <Search className="w-8 h-8 text-muted-foreground/50" />
            }
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {documents.length === 0 ? "Sin documentos todavía" : "Sin resultados"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {documents.length === 0
                ? "Sube tu primer documento para empezar a archivar"
                : "Prueba ajustando los filtros o el texto de búsqueda"
              }
            </p>
          </div>
          {documents.length === 0 && (
            <Link
              href="/subir"
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Subir documento
            </Link>
          )}
          {documents.length > 0 && (
            <button
              onClick={() => { setSearch(""); setFilterType("all"); setFilterStatus("all") }}
              className="text-xs font-medium text-accent hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {viewMode === "list" && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1.5fr_auto] gap-4 px-5 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>{t("columns.document")}</span>
                <span>{t("columns.company")}</span>
                <span>{t("columns.type")}</span>
                <span>{t("columns.amount")}</span>
                <span>{t("columns.date")}</span>
                <span>{t("columns.statusTags")}</span>
                <span />
              </div>
              <div className="divide-y divide-border">
                {paginated.map((doc) => {
                  const { icon: Icon, className: typeClass } = getTypeStyle(doc.document_type)
                  return (
                    <div key={doc.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1.5fr_auto] gap-4 items-center px-5 py-3.5 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <Link href={`/factura/${doc.id}`} className="text-sm font-medium text-foreground hover:text-accent truncate">
                          {doc.document_number}
                        </Link>
                      </div>
                      <span className="text-sm text-muted-foreground truncate">{doc.company?.name ?? "—"}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium inline-flex w-fit", typeClass)}>{tTypes(doc.document_type as any)}</span>
                      <span className="text-sm font-semibold text-foreground">{doc.total != null ? doc.total.toFixed(2) : "—"} €</span>
                      <span className="text-sm text-muted-foreground">{doc.issue_date ? new Date(doc.issue_date).toLocaleDateString() : "—"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[doc.status] ?? "bg-muted text-muted-foreground")}>{tStatuses(doc.status as any)}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/factura/${doc.id}`} className="p-1.5 rounded hover:bg-muted transition-colors" title="Ver">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        </Link>
                        <Link href={`/factura/${doc.id}/editar`} className="p-1.5 rounded hover:bg-muted transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {viewMode === "grid" && (
            <div className="grid grid-cols-4 gap-4">
              {paginated.map((doc) => {
                const { icon: Icon, className: typeClass } = getTypeStyle(doc.document_type)
                return (
                  <Link href={`/factura/${doc.id}`} key={doc.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[doc.status] ?? "bg-muted text-muted-foreground")}>{tStatuses(doc.status as any)}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">{doc.document_number}</p>
                    <p className="text-xs text-muted-foreground mb-3">{doc.company?.name ?? "—"}</p>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", typeClass)}>{tTypes(doc.document_type as any)}</span>
                      <span className="text-sm font-bold text-foreground">{doc.total != null ? doc.total.toFixed(2) : "—"} €</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{doc.issue_date ? new Date(doc.issue_date).toLocaleDateString() : "—"}</p>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-muted-foreground">
                Mostrando{" "}
                <span className="font-medium text-foreground">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
                </span>{" "}
                de <span className="font-medium text-foreground">{filtered.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce<(number | "…")[]>((acc, n, idx, arr) => {
                    if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…")
                    acc.push(n)
                    return acc
                  }, [])
                  .map((n, i) =>
                    n === "…" ? (
                      <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n as number)}
                        className={cn(
                          "min-w-[32px] h-8 px-2 text-xs rounded-lg border transition-colors",
                          page === n
                            ? "bg-primary text-primary-foreground border-primary font-semibold"
                            : "border-border hover:bg-muted text-foreground"
                        )}
                      >
                        {n}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
