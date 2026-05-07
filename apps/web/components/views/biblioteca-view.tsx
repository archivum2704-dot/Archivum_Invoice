"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  FileText, Package, Receipt, FolderOpen, Folder,
  Search, Filter, Grid3X3, List, Plus, Eye, ChevronDown, FileSpreadsheet, Pencil,
  ChevronLeft, ChevronRight, CalendarDays, X, Building2, FolderPlus, Check, Loader2,
  MoveRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"
import { useFolders } from "@/lib/hooks/use-folders"
import { downloadCSV, downloadExcel } from "@/lib/utils/export"
import { createClient } from "@/lib/supabase/client"

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
  const tSearch = useTranslations("documents.search")
  const tFolders = useTranslations("folders")
  const tCommon = useTranslations("common")

  const PAGE_SIZE = 20

  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null) // null = all docs
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [movingDoc, setMovingDoc] = useState<string | null>(null) // doc id being moved
  const [page, setPage] = useState(1)
  const [previewDoc, setPreviewDoc] = useState<(typeof documents)[number] | null>(null)
  const [thumbReady, setThumbReady] = useState(false)
  const [dragDocId, setDragDocId] = useState<string | null>(null)
  const [dragOverFolder, setDragOverFolder] = useState<string | "root" | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const { currentOrg, isOrgAdmin } = useOrganization()
  const { documents, loading, mutate: mutateDocuments } = useDocuments(currentOrg?.id ?? null)
  const { folders, mutate: mutateFolders } = useFolders(currentOrg?.id ?? null)

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentOrg) return
    setCreatingFolder(true)
    const supabase = createClient()
    const { error } = await supabase.from("folders").insert({
      organization_id: currentOrg.id,
      name: newFolderName.trim(),
    })
    if (!error) {
      mutateFolders()
      setNewFolderName("")
      setShowNewFolder(false)
    }
    setCreatingFolder(false)
  }

  const handleMoveToFolder = async (docId: string, folderId: string | null) => {
    const supabase = createClient()
    await supabase.from("documents").update({ folder_id: folderId, updated_at: new Date().toISOString() }).eq("id", docId)
    mutateDocuments()
    setMovingDoc(null)
  }

  // Delay thumbnail render to avoid flicker on fast mouse passes
  useEffect(() => {
    setThumbReady(false)
    if (!previewDoc) return
    const timer = setTimeout(() => setThumbReady(true), 250)
    return () => clearTimeout(timer)
  }, [previewDoc?.id])

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
    const matchDate = (() => {
      if (!dateFrom && !dateTo) return true
      if (!d.issue_date) return !dateFrom  // docs without date only shown when no lower bound
      const d_ = d.issue_date.slice(0, 10)
      if (dateFrom && d_ < dateFrom) return false
      if (dateTo && d_ > dateTo) return false
      return true
    })()
    const matchFolder = selectedFolder === null
      ? true
      : (d as any).folder_id === selectedFolder
    return matchSearch && matchType && matchStatus && matchDate && matchFolder
  }), [documents, search, filterType, filterStatus, dateFrom, dateTo, selectedFolder])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, filterType, filterStatus, dateFrom, dateTo, selectedFolder])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const getTypeStyle = (type: string) => TYPE_STYLES[type] ?? { icon: FileText, className: "bg-muted text-muted-foreground" }

  return (
    <div className="flex min-h-0 h-full">

      {/* ── Folder sidebar ──────────────────────────────────────── */}
      <div className="w-52 shrink-0 border-r border-border bg-card/30 flex flex-col p-3 gap-1 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tFolders("title")}</span>
          {isOrgAdmin && (
            <button
              onClick={() => setShowNewFolder(v => !v)}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title={tFolders("newFolder")}
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* New folder input */}
        {showNewFolder && (
          <div className="flex items-center gap-1.5 px-2 mb-1">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleCreateFolder()
                if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName("") }
              }}
              placeholder={tFolders("folderName")}
              className="flex-1 min-w-0 px-2 py-1 text-xs bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || creatingFolder}
              className="p-1 rounded bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {creatingFolder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
            <button onClick={() => { setShowNewFolder(false); setNewFolderName("") }} className="p-1 rounded hover:bg-muted">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* All documents — drop target for removing folder */}
        <button
          onClick={() => setSelectedFolder(null)}
          onDragOver={(e) => { e.preventDefault(); setDragOverFolder("root") }}
          onDragLeave={() => setDragOverFolder(null)}
          onDrop={(e) => { e.preventDefault(); if (dragDocId) handleMoveToFolder(dragDocId, null); setDragOverFolder(null); setDragDocId(null) }}
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all text-left w-full",
            dragOverFolder === "root"
              ? "bg-primary/15 border border-primary/40 text-primary scale-[1.02]"
              : selectedFolder === null
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <FolderOpen className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1">{tFolders("allDocuments")}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{documents.length}</span>
        </button>

        {/* Folder list */}
        {folders.map(folder => {
          const count = documents.filter((d: any) => d.folder_id === folder.id).length
          return (
            <div key={folder.id} className="relative group/folder">
              <button
                onClick={() => setSelectedFolder(folder.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolder(folder.id) }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => { e.preventDefault(); if (dragDocId) handleMoveToFolder(dragDocId, folder.id); setDragOverFolder(null); setDragDocId(null) }}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all text-left w-full",
                  dragOverFolder === folder.id
                    ? "bg-primary/15 border border-primary/40 text-primary scale-[1.02]"
                    : selectedFolder === folder.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Folder className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{folder.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
              </button>
            </div>
          )
        })}

        {folders.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center mt-4 px-2">{tFolders("noFolders")}</p>
        )}
      </div>

      {/* ── Main content ───────────────────────────────────────── */}
      <div className="flex-1 min-w-0 p-8 overflow-y-auto">
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

      {/* Filter bar — row 1 */}
      <div className="flex items-center gap-3 mb-3">
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

      {/* Filter bar — row 2: date range */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="w-4 h-4" />
          <span>{tSearch("dateFilter")}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo("") }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
            {t("clearFilters")}
          </button>
        )}
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
              {documents.length === 0 ? t("noDocuments") : t("all")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {documents.length === 0 ? t("noDocumentsHint") : t("noResultsHint")}
            </p>
          </div>
          {documents.length === 0 && (
            <Link
              href="/subir"
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> {t("uploadNew")}
            </Link>
          )}
          {documents.length > 0 && (
            <button
              onClick={() => { setSearch(""); setFilterType("all"); setFilterStatus("all") }}
              className="text-xs font-medium text-accent hover:underline"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
      ) : (
        <>
          {viewMode === "list" && (
            <div className="relative">
              <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
                <div className="min-w-[700px]">
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
                      <div
                        key={doc.id}
                        draggable
                        onDragStart={() => { setDragDocId(doc.id); setPreviewDoc(null) }}
                        onDragEnd={() => { setDragDocId(null); setDragOverFolder(null) }}
                        className={cn(
                          "grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1.5fr_auto] gap-4 items-center px-5 py-3.5 hover:bg-muted/30 transition-all group relative cursor-grab active:cursor-grabbing select-none",
                          dragDocId === doc.id && "opacity-40 scale-[0.98]"
                        )}
                        onMouseEnter={() => { if (!dragDocId) setPreviewDoc(doc) }}
                        onMouseLeave={() => setPreviewDoc(null)}
                      >
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
                        <span className="text-sm font-semibold text-foreground">{doc.total != null ? `${doc.total.toFixed(2)} ${doc.currency ?? "€"}` : "—"}</span>
                        <span className="text-sm text-muted-foreground">{doc.issue_date ? new Date(doc.issue_date).toLocaleDateString() : "—"}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[doc.status] ?? "bg-muted text-muted-foreground")}>{tStatuses(doc.status as any)}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/factura/${doc.id}`} className="p-1.5 rounded hover:bg-muted transition-colors" title={tActions("preview")}>
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </Link>
                          <Link href={`/factura/${doc.id}/editar`} className="p-1.5 rounded hover:bg-muted transition-colors" title={tCommon("editDocument")}>
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Link>
                          {/* Move to folder */}
                          <div className="relative">
                            <button
                              onClick={() => setMovingDoc(movingDoc === doc.id ? null : doc.id)}
                              className="p-1.5 rounded hover:bg-muted transition-colors"
                              title={tFolders("moveToFolder")}
                            >
                              <MoveRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            {movingDoc === doc.id && (
                              <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-lg z-30 overflow-hidden w-44">
                                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">{tFolders("moveToFolder")}</p>
                                {(doc as any).folder_id && (
                                  <button
                                    onClick={() => handleMoveToFolder(doc.id, null)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left"
                                  >
                                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                                    {tFolders("moveToRoot")}
                                  </button>
                                )}
                                {folders.map(f => (
                                  <button
                                    key={f.id}
                                    onClick={() => handleMoveToFolder(doc.id, f.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left"
                                  >
                                    <Folder className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="truncate">{f.name}</span>
                                    {(doc as any).folder_id === f.id && <Check className="w-3 h-3 text-primary ml-auto" />}
                                  </button>
                                ))}
                                {folders.length === 0 && (
                                  <p className="px-3 py-2 text-xs text-muted-foreground">{tFolders("noFolders")}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                </div>
              </div>

              {/* Hover preview card */}
              {previewDoc && (() => {
                const { icon: PIcon, className: pTypeClass } = getTypeStyle(previewDoc.document_type)
                const fileUrl = (previewDoc as any).file_url as string | null
                const isImage = fileUrl ? /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(fileUrl) : false
                return (
                  <div className="absolute right-0 top-0 z-30 w-72 bg-background border border-border rounded-xl shadow-xl p-4 pointer-events-none translate-x-[calc(100%+12px)]">

                    {/* Document thumbnail */}
                    {fileUrl ? (
                      <div className="relative w-full rounded-lg overflow-hidden bg-muted border border-border mb-3" style={{ height: 130 }}>
                        {!thumbReady && (
                          <div className="absolute inset-0 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                            <PIcon className="w-8 h-8 text-muted-foreground/30" />
                          </div>
                        )}
                        {thumbReady && (
                          isImage ? (
                            <img
                              src={fileUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            /* Scale a full-size iframe down to thumbnail */
                            <div style={{
                              position: 'absolute', top: 0, left: 0,
                              width: '300%', height: '300%',
                              transform: 'scale(0.333)',
                              transformOrigin: 'top left',
                              pointerEvents: 'none',
                            }}>
                              <iframe
                                src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit`}
                                style={{ width: '100%', height: '100%', border: 0 }}
                                title={previewDoc.document_number ?? "preview"}
                              />
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-20 rounded-lg bg-muted border border-border mb-3 flex items-center justify-center">
                        <PIcon className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <PIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{previewDoc.document_number ?? "—"}</p>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", pTypeClass)}>{tTypes(previewDoc.document_type as any)}</span>
                      </div>
                    </div>
                    {previewDoc.company?.name && (
                      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{previewDoc.company.name}</span>
                      </div>
                    )}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{tFields("amount")}</span>
                        <span className="font-semibold text-foreground">
                          {previewDoc.total != null ? `${previewDoc.total.toFixed(2)} ${previewDoc.currency ?? "€"}` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{tFields("issueDate")}</span>
                        <span className="text-foreground">{previewDoc.issue_date ? new Date(previewDoc.issue_date).toLocaleDateString() : "—"}</span>
                      </div>
                      {previewDoc.due_date && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{tFields("dueDate")}</span>
                          <span className="text-foreground">{new Date(previewDoc.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-muted-foreground">{tFields("status")}</span>
                        <span className={cn("px-1.5 py-0.5 rounded-full font-medium", STATUS_STYLES[previewDoc.status] ?? "bg-muted text-muted-foreground")}>
                          {tStatuses(previewDoc.status as any)}
                        </span>
                      </div>
                    </div>
                    {previewDoc.notes && (
                      <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2 line-clamp-2">{previewDoc.notes}</p>
                    )}
                    <p className="mt-3 text-[10px] text-muted-foreground/50 text-center">{tActions("preview")} →</p>
                  </div>
                )
              })()}
            </div>
          )}

          {viewMode === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
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
                {t("showing", {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, filtered.length),
                  total: filtered.length,
                })}
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
      </div> {/* end main content */}
    </div>
  )
}
