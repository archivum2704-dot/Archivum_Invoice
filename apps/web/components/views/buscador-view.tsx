"use client"

import { useState } from "react"
import {
  Search, SlidersHorizontal, FileText, Package, Receipt,
  CalendarDays, Building2, Tag, X, ChevronRight, ArrowUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"

const TYPE_ICONS: Record<string, React.ElementType> = {
  invoice_issued: FileText,
  invoice_received: FileText,
  delivery_note: Package,
  receipt: Receipt,
  order: FileText,
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

const DOC_TYPES = ["invoice_issued", "invoice_received", "delivery_note", "receipt", "order"] as const
const DOC_STATUSES = ["paid", "pending", "overdue", "draft", "cancelled"] as const
const TAGS = ["Obra", "Madrid", "Stock", "Software", "Anual", "Transporte", "Material", "Reforma", "Mantenimiento", "Logística"]

export function BuscadorView() {
  const t = useTranslations("documents.search")
  const tTypes = useTranslations("documents.types")
  const tStatuses = useTranslations("documents.statuses")

  const [query, setQuery] = useState("")
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const { currentOrg } = useOrganization()
  const { documents, loading } = useDocuments(currentOrg?.id ?? null)

  const toggle = (arr: string[], setArr: (a: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])
  }

  const clearAll = () => {
    setQuery(""); setSelectedTypes([]); setSelectedStatuses([])
    setSelectedTags([]); setDateFrom(""); setDateTo("")
  }

  const activeCount = selectedTypes.length + selectedStatuses.length + selectedTags.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)

  const results = documents.filter((d) => {
    const matchQuery = !query || d.document_number.toLowerCase().includes(query.toLowerCase())
    const matchType = !selectedTypes.length || selectedTypes.includes(d.document_type)
    const matchStatus = !selectedStatuses.length || selectedStatuses.includes(d.status)
    return matchQuery && matchType && matchStatus
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground text-balance">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder={t("placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 text-base bg-card border-2 border-border rounded-xl focus:outline-none focus:border-accent placeholder:text-muted-foreground transition-colors"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <div className="flex gap-6">
        <aside className="w-60 shrink-0">
          <div className="bg-card border border-border rounded-xl p-4 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{t("filters")}</span>
                {activeCount > 0 && (
                  <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full font-medium">{activeCount}</span>
                )}
              </div>
              {activeCount > 0 && (
                <button onClick={clearAll} className="text-xs text-accent hover:underline">{t("clearFilters")}</button>
              )}
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("typeFilter")}</span>
              </div>
              <div className="space-y-1.5">
                {DOC_TYPES.map((k) => (
                  <label key={k} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={selectedTypes.includes(k)} onChange={() => toggle(selectedTypes, setSelectedTypes, k)} className="w-3.5 h-3.5 rounded accent-accent" />
                    <span className="text-sm text-foreground group-hover:text-accent transition-colors">{tTypes(k)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("statusFilter")}</span>
              </div>
              <div className="space-y-1.5">
                {DOC_STATUSES.map((k) => (
                  <label key={k} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={selectedStatuses.includes(k)} onChange={() => toggle(selectedStatuses, setSelectedStatuses, k)} className="w-3.5 h-3.5 rounded accent-accent" />
                    <span className="text-sm text-foreground group-hover:text-accent transition-colors">{tStatuses(k)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("dateFilter")}</span>
              </div>
              <div className="space-y-2">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("tagsFilter")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((et) => (
                  <button key={et} onClick={() => toggle(selectedTags, setSelectedTags, et)} className={cn("text-xs px-2 py-0.5 rounded-full border transition-colors", selectedTags.includes(et) ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-border hover:border-accent")}>
                    {et}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
              <p className="text-muted-foreground text-sm">{t("loading")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{results.length}</span>{" "}
                  {t("results", { count: results.length }).replace(String(results.length), "").trim()}
                </p>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowUpDown className="w-3.5 h-3.5" />{t("sortByDate")}
                </button>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-foreground font-medium">{t("noResults")}</p>
                    <p className="text-muted-foreground text-sm mt-1">{t("noResultsHint")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {results.map((doc) => {
                      const Icon = TYPE_ICONS[doc.document_type] ?? FileText
                      return (
                        <Link href={`/factura/${doc.id}`} key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-semibold text-foreground">{doc.document_number}</p>
                              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", TYPE_STYLES[doc.document_type] ?? "bg-muted text-muted-foreground")}>{tTypes(doc.document_type as any)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">—</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-foreground">{doc.total_amount.toFixed(2)} €</span>
                            <span className="text-xs text-muted-foreground w-20 text-right">{doc.issue_date ? new Date(doc.issue_date).toLocaleDateString() : "—"}</span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[doc.status] ?? "bg-muted text-muted-foreground")}>{tStatuses(doc.status as any)}</span>
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
