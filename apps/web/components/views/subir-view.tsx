"use client"

import { useState, useRef, useEffect } from "react"
import {
  Upload, FileText, Image, Scan, X, CheckCircle2,
  Building2, Tag, Calendar, ChevronDown, Plus, ArrowLeft, AlertCircle, Loader2,
  Link2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useCompanies } from "@/lib/hooks/use-companies"
import { createClient } from "@/lib/supabase/client"

const CURRENCIES = [
  { code: "EUR", label: "€ Euro" },
  { code: "USD", label: "$ Dólar USA" },
  { code: "GBP", label: "£ Libra esterlina" },
  { code: "CHF", label: "CHF Franco suizo" },
  { code: "MXN", label: "$ Peso mexicano" },
  { code: "COP", label: "$ Peso colombiano" },
  { code: "ARS", label: "$ Peso argentino" },
  { code: "CLP", label: "$ Peso chileno" },
  { code: "BRL", label: "R$ Real brasileño" },
  { code: "CAD", label: "$ Dólar canadiense" },
  { code: "AUD", label: "$ Dólar australiano" },
  { code: "JPY", label: "¥ Yen japonés" },
  { code: "CNY", label: "¥ Yuan chino" },
]

const DOC_TYPES = [
  "invoice_issued", "invoice_received", "delivery_note",
  "receipt", "order", "quote", "contract", "payroll", "tax", "other",
] as const

const DOC_STATUSES = ["draft", "pending", "paid", "overdue", "cancelled"] as const

const DEFAULT_TAGS = ["Obra", "Madrid", "Stock", "Software", "Anual", "Transporte", "Material", "Reforma", "Mantenimiento", "Logistica"]

type UploadedFile = { file: File; name: string; size: string; kind: "image" | "pdf" }

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`
}

type ParentDoc = {
  id: string
  document_number: string | null
  document_type: string
  company_id: string | null
  total: number | null
  currency: string
}

export function SubirView() {
  const t        = useTranslations("documents.upload")
  const tTypes   = useTranslations("documents.types")
  const tStatuses = useTranslations("documents.statuses")
  const tFields  = useTranslations("documents.fields")
  const tCommon  = useTranslations("common")
  const { currentOrg, userProfile } = useOrganization()
  const { companies } = useCompanies(currentOrg?.id ?? null)
  const searchParams = useSearchParams()
  const fromId   = searchParams.get("from")
  const fromType = searchParams.get("type")

  const [dragOver,   setDragOver]   = useState(false)
  const [files,      setFiles]      = useState<UploadedFile[]>([])
  const [tipo,       setTipo]       = useState(fromType ?? "")
  const [empresa,    setEmpresa]    = useState("")
  const [estado,     setEstado]     = useState("")
  const [fecha,      setFecha]      = useState("")
  const [importe,    setImporte]    = useState("")
  const [numero,     setNumero]     = useState("")
  const [etiquetas,  setEtiquetas]  = useState<string[]>([])
  const [notas,      setNotas]      = useState("")
  const [moneda,     setMoneda]     = useState("EUR")
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [uploadedId, setUploadedId] = useState<string | null>(null)
  const [parentDoc,  setParentDoc]  = useState<ParentDoc | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load parent document if ?from= is present ───────────────────────────────
  useEffect(() => {
    if (!fromId) return
    const supabase = createClient()
    supabase
      .from("documents")
      .select("id, document_number, document_type, company_id, total, currency")
      .eq("id", fromId)
      .single()
      .then(({ data }) => {
        if (!data) return
        setParentDoc(data as ParentDoc)
        // Pre-fill company and amount from parent
        if (data.company_id) setEmpresa(data.company_id)
        if (data.total != null)
          setImporte(data.total.toFixed(2).replace(".", ","))
      })
  }, [fromId])

  const addFile = (f: File) => {
    setFiles(prev => [...prev, {
      file: f,
      name: f.name,
      size: formatSize(f.size),
      kind: f.type.startsWith("image") ? "image" : "pdf",
    }])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    Array.from(e.dataTransfer.files).forEach(addFile)
  }

  const toggleEtiqueta = (et: string) =>
    setEtiquetas(prev => prev.includes(et) ? prev.filter(x => x !== et) : [...prev, et])

  const reset = () => {
    setFiles([]); setNumero(""); setImporte(""); setNotas(""); setMoneda("EUR")
    setEtiquetas([]); setTipo(fromType ?? ""); setEmpresa(""); setEstado(""); setFecha("")
    setError(null); setUploadedId(null)
  }

  // ── Real Supabase upload ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrg) return
    setLoading(true); setError(null)

    try {
      const supabase = createClient()
      let fileUrl: string | null = null
      let fileName: string | null = null
      let fileSize: number | null = null
      let fileType: string | null = null

      // 1. Upload file to Storage if one is selected
      if (files.length > 0) {
        const f = files[0].file
        const ext = f.name.split(".").pop() ?? "bin"
        const storagePath = `${currentOrg.id}/${crypto.randomUUID()}.${ext}`

        const { error: storageErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, f, { contentType: f.type, upsert: false })

        if (storageErr) {
          // Non-blocking: continue without file if storage fails (bucket may not exist yet)
          console.warn("Storage upload failed:", storageErr.message)
        } else {
          fileUrl  = storagePath   // store path; factura-view generates signed URL on demand
          fileName = f.name
          fileSize = f.size
          fileType = f.type
        }
      }

      // 2. Parse amount
      const totalAmount = importe
        ? parseFloat(importe.replace(/\./g, "").replace(",", "."))
        : null

      // 3. Insert document record
      const { data, error: insertErr } = await supabase
        .from("documents")
        .insert({
          organization_id:    currentOrg.id,
          company_id:         empresa || null,
          uploaded_by:        userProfile?.id ?? null,
          parent_document_id: fromId || null,
          document_number:    numero.trim() || null,
          document_type:      tipo as any,
          status:             (estado || "pending") as any,
          total:              totalAmount,
          currency:           moneda,
          issue_date:         fecha || null,
          notes:              notas.trim() || null,
          file_url:           fileUrl,
          file_name:          fileName,
          file_size:          fileSize,
          file_type:          fileType,
        })
        .select("id")
        .single()

      if (insertErr) throw insertErr

      setUploadedId(data.id)
    } catch (err: any) {
      setError(err?.message ?? t("errorArchiving"))
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (uploadedId) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{t("successTitle")}</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            {t("successMessage", { number: numero || "—" })}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={`/factura/${uploadedId}`}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {t("viewInLibrary")}
            </Link>
            <button
              onClick={reset}
              className="px-4 py-2 bg-card border border-border text-sm text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              {t("uploadAnother")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={fromId ? `/factura/${fromId}` : "/biblioteca"} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
        </div>
      </div>

      {/* Parent doc banner */}
      {parentDoc && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <Link2 className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{t("creatingFrom")}</p>
            <p className="text-sm font-medium text-foreground">
              {tTypes(parentDoc.document_type as any)} ·{" "}
              <Link href={`/factura/${parentDoc.id}`} className="text-primary hover:underline">
                {parentDoc.document_number ?? parentDoc.id.slice(0, 8).toUpperCase()}
              </Link>
            </p>
          </div>
          <Link
            href={`/factura/${parentDoc.id}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {t("viewOriginal")}
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-5">

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors",
                dragOver ? "border-accent bg-accent/5" : "border-border bg-card hover:border-accent/50 hover:bg-muted/30"
              )}
            >
              <input
                ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden"
                onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(addFile) }}
              />
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{t("dragTitle")}</p>
              <p className="text-xs text-muted-foreground mb-3">{t("dragSubtitle")}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> PDF</span>
                <span className="flex items-center gap-1.5"><Image className="w-3.5 h-3.5" /> JPG, PNG</span>
                <span className="flex items-center gap-1.5"><Scan className="w-3.5 h-3.5" /> Scans</span>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-2">{t("maxSize")}</p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <p className="text-sm font-semibold text-foreground">{t("filesSelected", { count: files.length })}</p>
                </div>
                <div className="divide-y divide-border">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {f.kind === "image" ? <Image className="w-4 h-4 text-muted-foreground" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.size}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <button
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        className="p-1 hover:bg-muted rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document metadata */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">{t("docInfo")}</h2>
              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t("docType")}</label>
                  <div className="relative">
                    <select required value={tipo} onChange={e => setTipo(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                      <option value="">{t("selectType")}</option>
                      {DOC_TYPES.map(k => <option key={k} value={k}>{tTypes(k)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t("docNumber")}</label>
                  <input required type="text" placeholder="FAC-2024-0001" value={numero}
                    onChange={e => setNumero(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    <Building2 className="w-3.5 h-3.5 inline mr-1" />{t("company")}
                  </label>
                  <div className="relative">
                    <select required value={empresa} onChange={e => setEmpresa(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                      <option value="">{t("selectCompany")}</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                  <Link href="/empresas"
                    className="inline-flex items-center gap-1 mt-1.5 text-xs text-muted-foreground hover:text-accent transition-colors">
                    <Plus className="w-3 h-3" />
                    {companies.length === 0 ? t("addFirstCompany") : tCommon("newCompany")}
                  </Link>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t("amount")}</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="0,00" value={importe} onChange={e => setImporte(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                    <div className="relative">
                      <select value={moneda} onChange={e => setMoneda(e.target.value)}
                        className="appearance-none pl-2 pr-6 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground font-mono">
                        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />{t("issueDate")}
                  </label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{tFields("status")}</label>
                  <div className="relative">
                    <select value={estado} onChange={e => setEstado(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                      <option value="">{t("selectStatus")}</option>
                      {DOC_STATUSES.map(k => <option key={k} value={k}>{tStatuses(k)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t("additionalNotes")}</label>
                <textarea rows={3} placeholder={t("notesPlaceholder")} value={notas} onChange={e => setNotas(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none leading-relaxed" />
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">{t("tags")}</h2>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {DEFAULT_TAGS.map(et => (
                  <button key={et} type="button" onClick={() => toggleEtiqueta(et)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors",
                      etiquetas.includes(et)
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-muted text-muted-foreground border-border hover:border-accent"
                    )}>
                    {et}
                  </button>
                ))}
              </div>
              {etiquetas.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{t("tagsSelected", { count: etiquetas.length })}</p>
              )}
            </div>

            {files.length === 0 && (
              <div className="flex items-start gap-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-xs text-foreground leading-relaxed">{t("noFileWarning")}</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive leading-relaxed">{error}</p>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("archiving")}</>
                  : <><Upload className="w-4 h-4" />{t("submit")}</>
                }
              </button>
              <Link href="/biblioteca"
                className="w-full flex items-center justify-center py-2.5 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
                {tCommon("cancel")}
              </Link>
              <p className="text-xs text-muted-foreground text-center leading-relaxed">{t("requiredNote")}</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
