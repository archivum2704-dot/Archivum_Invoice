"use client"

import { useEffect, useState } from "react"
import {
  ArrowLeft, Download, FileText, Building2, Calendar,
  Hash, Clock, CheckCircle2, AlertCircle, FileX,
  ChevronRight, Plus, ArrowRight, Pencil,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Database, DocumentType } from "@/lib/supabase/types"

// ── Types ──────────────────────────────────────────────────────────────────────
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type DocumentWithCompany = DocumentRow & {
  company: { name: string; cif: string | null } | null
}
type DocRef = {
  id: string
  document_number: string | null
  document_type: DocumentType
  status: string
}

// ── Workflow config ────────────────────────────────────────────────────────────
const WORKFLOW_STEPS: DocumentType[] = ["order", "delivery_note", "invoice_issued"]

const WORKFLOW_NEXT: Partial<Record<DocumentType, DocumentType>> = {
  order:         "delivery_note",
  delivery_note: "invoice_issued",
}

const TYPE_ICON_COLOR: Record<string, string> = {
  order:            "bg-blue-100 text-blue-600",
  delivery_note:    "bg-primary/10 text-primary",
  invoice_issued:   "bg-accent/10 text-accent",
  invoice_received: "bg-primary/10 text-primary",
  receipt:          "bg-muted text-muted-foreground",
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground",
  pending:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid:      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  overdue:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
}

function formatDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("es-ES", {
    day: "numeric", month: "long", year: "numeric",
  })
}

function formatAmount(n: number | null, currency = "EUR"): string {
  if (n == null) return "—"
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(n)
}

// ── Sub-components ────────────────────────────────────────────────────────────
function MetaRow({
  icon: Icon, label, value, sub,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ── Workflow Chain ─────────────────────────────────────────────────────────────
function WorkflowChain({
  current, parent, children, tTypes,
}: {
  current: DocumentWithCompany
  parent: DocRef | null
  children: DocRef[]
  tTypes: (k: any) => string
}) {
  const nextType = WORKFLOW_NEXT[current.document_type as DocumentType]
  const hasChild = children.some(c => c.document_type === nextType)
  const isInWorkflow = WORKFLOW_STEPS.includes(current.document_type as DocumentType)

  if (!isInWorkflow && !parent && children.length === 0) return null

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Workflow
      </p>

      <div className="space-y-1.5">
        {/* Parent */}
        {parent && (
          <Link
            href={`/factura/${parent.id}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
          >
            <span className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0", TYPE_ICON_COLOR[parent.document_type] ?? "bg-muted text-muted-foreground")}>
              <FileText className="w-3 h-3" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{tTypes(parent.document_type)}</p>
              <p className="text-xs font-medium text-foreground truncate">{parent.document_number ?? parent.id.slice(0, 8)}</p>
            </div>
            <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </Link>
        )}

        {/* Connector line */}
        {parent && (
          <div className="ml-[18px] w-px h-3 bg-border" />
        )}

        {/* Current */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <span className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0", TYPE_ICON_COLOR[current.document_type] ?? "bg-muted text-muted-foreground")}>
            <FileText className="w-3 h-3" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{tTypes(current.document_type)}</p>
            <p className="text-xs font-medium text-foreground truncate">
              {current.document_number ?? current.id.slice(0, 8)} · <span className="text-primary">actual</span>
            </p>
          </div>
        </div>

        {/* Children */}
        {children.map(child => (
          <div key={child.id}>
            <div className="ml-[18px] w-px h-3 bg-border" />
            <Link
              href={`/factura/${child.id}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
            >
              <span className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0", TYPE_ICON_COLOR[child.document_type] ?? "bg-muted text-muted-foreground")}>
                <FileText className="w-3 h-3" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{tTypes(child.document_type)}</p>
                <p className="text-xs font-medium text-foreground truncate">{child.document_number ?? child.id.slice(0, 8)}</p>
              </div>
              <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </Link>
          </div>
        ))}

        {/* Next step CTA */}
        {nextType && !hasChild && (
          <>
            <div className="ml-[18px] w-px h-3 bg-border border-dashed" />
            <Link
              href={`/subir?from=${current.id}&type=${nextType}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group"
            >
              <span className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Plus className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Siguiente paso</p>
                <p className="text-xs font-medium text-foreground group-hover:text-primary">
                  Crear {tTypes(nextType)}
                </p>
              </div>
              <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary" />
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
interface FacturaViewProps { id: string }

export function FacturaView({ id }: FacturaViewProps) {
  const tTypes    = useTranslations("documents.types")
  const tStatuses = useTranslations("documents.statuses")
  const tFields   = useTranslations("documents.fields")
  const tActions  = useTranslations("documents.actions")
  const tCommon   = useTranslations("common")

  const [doc,      setDoc]      = useState<DocumentWithCompany | null>(null)
  const [parent,   setParent]   = useState<DocRef | null>(null)
  const [children, setChildren] = useState<DocRef[]>([])
  const [pdfUrl,   setPdfUrl]   = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<"preview" | "details">("preview")

  // ── Fetch document + resolve signed URL + workflow links ────────────────────
  useEffect(() => {
    if (!id) return
    setLoading(true)
    const supabase = createClient()

    supabase
      .from("documents")
      .select("*, company:companies(name, cif)")
      .eq("id", id)
      .single()
      .then(async ({ data, error: err }) => {
        if (err || !data) {
          setError(err?.message ?? "Document not found")
          setLoading(false)
          return
        }

        const d = data as DocumentWithCompany
        setDoc(d)

        // Resolve PDF URL
        const fileUrl = d.file_url
        if (fileUrl) {
          if (fileUrl.startsWith("http")) {
            setPdfUrl(fileUrl)
          } else {
            const { data: signed } = await supabase.storage
              .from("documents")
              .createSignedUrl(fileUrl, 3600)
            if (signed?.signedUrl) setPdfUrl(signed.signedUrl)
          }
        }

        // Fetch parent doc
        if (d.parent_document_id) {
          const { data: p } = await supabase
            .from("documents")
            .select("id, document_number, document_type, status")
            .eq("id", d.parent_document_id)
            .single()
          if (p) setParent(p as DocRef)
        }

        // Fetch children
        const { data: ch } = await supabase
          .from("documents")
          .select("id, document_number, document_type, status")
          .eq("parent_document_id", id)
          .order("created_at")
        if (ch) setChildren(ch as DocRef[])

        setLoading(false)
      })
  }, [id])

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="text-sm text-muted-foreground animate-pulse">{tCommon("loading")}</span>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !doc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="w-10 h-10 text-destructive/50" />
        <p className="text-sm text-muted-foreground">{error ?? tCommon("error")}</p>
        <Link href="/biblioteca" className="text-sm text-primary hover:underline">{tCommon("back")}</Link>
      </div>
    )
  }

  // ── Derived labels ───────────────────────────────────────────────────────────
  const typeLabel   = tTypes(doc.document_type as Parameters<typeof tTypes>[0])
  const statusLabel = tStatuses(doc.status as Parameters<typeof tStatuses>[0])
  const docTitle    = doc.document_number ?? doc.id.slice(0, 8).toUpperCase()

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 0px)" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border shrink-0 bg-background">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/biblioteca"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            {tCommon("back")}
          </Link>
          <div className="w-px h-4 bg-border shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">{docTitle}</span>
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline">· {typeLabel}</span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
              STATUS_STYLES[doc.status] ?? STATUS_STYLES.draft
            )}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile tabs */}
          <div className="flex lg:hidden bg-muted rounded-lg p-0.5">
            {(["preview", "details"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  mobileTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                {tab === "preview" ? "PDF" : "Info"}
              </button>
            ))}
          </div>

          {/* Edit button */}
          <Link
            href={`/factura/${doc.id}/editar`}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-card border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </Link>

          {/* Next step shortcut (desktop) */}
          {WORKFLOW_NEXT[doc.document_type as DocumentType] &&
           !children.some(c => c.document_type === WORKFLOW_NEXT[doc.document_type as DocumentType]) && (
            <Link
              href={`/subir?from=${doc.id}&type=${WORKFLOW_NEXT[doc.document_type as DocumentType]}`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-card border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear {tTypes(WORKFLOW_NEXT[doc.document_type as DocumentType] as Parameters<typeof tTypes>[0])}
            </Link>
          )}

          {pdfUrl && (
            <a
              href={pdfUrl}
              download={doc.file_name ?? "document.pdf"}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{tActions("download")}</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* PDF Panel */}
        <div className={cn(
          "flex-1 bg-zinc-100 dark:bg-zinc-900 overflow-hidden min-w-0",
          mobileTab === "details" ? "hidden lg:flex" : "flex"
        )}>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={doc.file_name ?? "Document preview"}
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full gap-5 text-muted-foreground">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <FileX className="w-10 h-10 opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Sin archivo adjunto</p>
                <p className="text-xs mt-1 text-muted-foreground max-w-xs">
                  Este documento no tiene un PDF o imagen vinculado
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Metadata sidebar */}
        <aside className={cn(
          "w-full lg:w-80 xl:w-96 border-l border-border bg-card overflow-y-auto shrink-0",
          mobileTab === "preview" ? "hidden lg:block" : "block"
        )}>
          <div className="p-5 space-y-5">

            {/* Doc type + status */}
            <div className="pb-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {tFields("type")}
              </p>
              <p className="text-base font-bold text-foreground">{typeLabel}</p>
              <span className={cn(
                "inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium",
                STATUS_STYLES[doc.status] ?? STATUS_STYLES.draft
              )}>
                {statusLabel}
              </span>
            </div>

            {/* Number */}
            {doc.document_number && (
              <MetaRow icon={Hash} label={tFields("number")} value={doc.document_number} />
            )}

            {/* Company */}
            {doc.company && (
              <MetaRow
                icon={Building2}
                label={tFields("company")}
                value={doc.company.name}
                sub={doc.company.cif ?? undefined}
              />
            )}

            {/* Dates */}
            <div className="space-y-3">
              <MetaRow icon={Calendar} label={tFields("issueDate")} value={formatDate(doc.issue_date)} />
              {doc.due_date && (
                <MetaRow icon={Clock} label={tFields("dueDate")} value={formatDate(doc.due_date)} />
              )}
              {doc.payment_date && (
                <MetaRow icon={CheckCircle2} label={tFields("paymentDate")} value={formatDate(doc.payment_date)} />
              )}
            </div>

            {/* Amounts */}
            {(doc.total != null || doc.subtotal != null) && (
              <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                {doc.subtotal != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatAmount(doc.subtotal, doc.currency)}</span>
                  </div>
                )}
                {doc.tax_amount != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IVA ({doc.tax_rate}%)</span>
                    <span className="font-medium">{formatAmount(doc.tax_amount, doc.currency)}</span>
                  </div>
                )}
                {doc.total != null && (
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-2 mt-1">
                    <span>{tFields("amount")}</span>
                    <span className="text-primary text-base">{formatAmount(doc.total, doc.currency)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {doc.notes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {tFields("notes")}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{doc.notes}</p>
              </div>
            )}

            {/* Attached file */}
            {doc.file_name && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {tFields("file")}
                </p>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted group cursor-default">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{doc.file_name}</span>
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      download={doc.file_name}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Download className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Workflow chain */}
            <WorkflowChain
              current={doc}
              parent={parent}
              children={children}
              tTypes={tTypes}
            />

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground/50 pt-2 border-t border-border">
              Archivado el {formatDate(doc.created_at)}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
