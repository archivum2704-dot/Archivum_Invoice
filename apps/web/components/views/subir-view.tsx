"use client"

import { useState, useRef } from "react"
import {
  Upload, FileText, Image, Scan, X, CheckCircle2,
  Building2, Tag, Calendar, ChevronDown, Plus, ArrowLeft, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useCompanies } from "@/lib/hooks/use-companies"

const DOC_TYPES = [
  "invoice_issued", "invoice_received", "delivery_note",
  "receipt", "order", "quote", "contract", "payroll", "tax", "other",
] as const

const DOC_STATUSES = ["draft", "pending", "paid", "overdue", "cancelled"] as const

const DEFAULT_TAGS = ["Obra", "Madrid", "Stock", "Software", "Anual", "Transporte", "Material", "Reforma", "Mantenimiento", "Logistica"]

type UploadedFile = { name: string; size: string; type: string }

export function SubirView() {
  const t = useTranslations("documents.upload")
  const tTypes = useTranslations("documents.types")
  const tStatuses = useTranslations("documents.statuses")
  const tFields = useTranslations("documents.fields")
  const tCommon = useTranslations("common")
  const { currentOrg } = useOrganization()
  const { companies } = useCompanies(currentOrg?.id ?? null)

  const [dragOver, setDragOver] = useState(false)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [tipo, setTipo] = useState("")
  const [empresa, setEmpresa] = useState("")
  const [estado, setEstado] = useState("")
  const [fecha, setFecha] = useState("")
  const [importe, setImporte] = useState("")
  const [numero, setNumero] = useState("")
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [notas, setNotas] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addFile = (f: File) => {
    setFiles((prev) => [
      ...prev,
      {
        name: f.name,
        size: f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`,
        type: f.type.includes("image") ? "image" : "pdf",
      },
    ])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    Array.from(e.dataTransfer.files).forEach(addFile)
  }

  const toggleEtiqueta = (et: string) => {
    setEtiquetas((prev) => prev.includes(et) ? prev.filter((x) => x !== et) : [...prev, et])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-[var(--status-paid)]/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-[var(--status-paid)]" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{t("successTitle")}</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            {t("successMessage", { number: numero || "new document" })}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/biblioteca"
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {t("viewInLibrary")}
            </Link>
            <button
              onClick={() => { setSubmitted(false); setFiles([]); setNumero(""); setImporte(""); setNotas(""); setEtiquetas([]) }}
              className="px-4 py-2 bg-card border border-border text-sm text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              {t("uploadAnother")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/biblioteca" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-5">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors",
                dragOver ? "border-accent bg-accent/5" : "border-border bg-card hover:border-accent/50 hover:bg-muted/30"
              )}
            >
              <input ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={(e) => { if (e.target.files) Array.from(e.target.files).forEach(addFile) }} />
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{t("dragTitle")}</p>
              <p className="text-xs text-muted-foreground mb-3">{t("dragSubtitle")}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> PDF</div>
                <div className="flex items-center gap-1.5"><Image className="w-3.5 h-3.5" /> JPG, PNG</div>
                <div className="flex items-center gap-1.5"><Scan className="w-3.5 h-3.5" /> Scans</div>
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
                        {f.type === "image" ? <Image className="w-4 h-4 text-muted-foreground" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.size}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-[var(--status-paid)]" />
                      <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="p-1 hover:bg-muted rounded transition-colors">
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
                    <select required value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                      <option value="">{t("selectType")}</option>
                      {DOC_TYPES.map((k) => <option key={k} value={k}>{tTypes(k)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t("docNumber")}</label>
                  <input required type="text" placeholder="FAC-2024-0001" value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    <Building2 className="w-3.5 h-3.5 inline mr-1" />{t("company")}
                  </label>
                  <div className="relative">
                    <select required value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                      <option value="">{t("selectCompany")}</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                  {companies.length === 0 && (
                    <Link href="/empresas" className="inline-flex items-center gap-1 mt-1.5 text-xs text-accent hover:underline">
                      <Plus className="w-3 h-3" /> Añadir primera empresa
                    </Link>
                  )}
                  {companies.length > 0 && (
                    <Link href="/empresas" className="inline-flex items-center gap-1 mt-1.5 text-xs text-muted-foreground hover:text-accent transition-colors">
                      <Plus className="w-3 h-3" /> Nueva empresa
                    </Link>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t("amount")}</label>
                  <input type="text" placeholder="0,00" value={importe} onChange={(e) => setImporte(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />{t("issueDate")}
                  </label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{tFields("status")}</label>
                  <div className="relative">
                    <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                      <option value="">{t("selectStatus")}</option>
                      {DOC_STATUSES.map((k) => <option key={k} value={k}>{tStatuses(k)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">{t("additionalNotes")}</label>
                <textarea rows={3} placeholder={t("notesPlaceholder")} value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none leading-relaxed" />
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
                {DEFAULT_TAGS.map((et) => (
                  <button key={et} type="button" onClick={() => toggleEtiqueta(et)} className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", etiquetas.includes(et) ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-border hover:border-accent")}>
                    {et}
                  </button>
                ))}
              </div>
              <button type="button" className="flex items-center gap-1.5 text-xs text-accent hover:underline">
                <Plus className="w-3 h-3" />{t("newTag")}
              </button>
              {etiquetas.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{t("tagsSelected", { count: etiquetas.length })}</p>
              )}
            </div>

            {files.length === 0 && (
              <div className="flex items-start gap-2.5 bg-[var(--status-pending)]/10 border border-[var(--status-pending)]/30 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-[var(--status-pending)] mt-0.5 shrink-0" />
                <p className="text-xs text-foreground leading-relaxed">{t("noFileWarning")}</p>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <button type="submit" className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                <Upload className="w-4 h-4" />{t("submit")}
              </button>
              <Link href="/biblioteca" className="w-full flex items-center justify-center py-2.5 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
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
