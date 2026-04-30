"use client"

import { useState, useRef, useEffect } from "react"
import {
  FileText, Image, X, CheckCircle2,
  Building2, Calendar, ChevronDown, Plus, ArrowLeft,
  AlertCircle, Loader2, Save, Upload,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useCompanies } from "@/lib/hooks/use-companies"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]

const DOC_TYPES = [
  "invoice_issued", "invoice_received", "delivery_note",
  "receipt", "order", "quote", "contract", "payroll", "tax", "other",
] as const

const DOC_STATUSES = ["draft", "pending", "paid", "overdue", "cancelled"] as const

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`
}

interface EditarViewProps { id: string }

export function EditarView({ id }: EditarViewProps) {
  const t        = useTranslations("documents.upload")
  const tTypes   = useTranslations("documents.types")
  const tStatuses = useTranslations("documents.statuses")
  const tFields  = useTranslations("documents.fields")
  const tCommon  = useTranslations("common")
  const router   = useRouter()
  const { currentOrg } = useOrganization()
  const { companies }  = useCompanies(currentOrg?.id ?? null)

  // Form state
  const [tipo,       setTipo]       = useState("")
  const [empresa,    setEmpresa]    = useState("")
  const [estado,     setEstado]     = useState("")
  const [fecha,      setFecha]      = useState("")
  const [fechaVenc,  setFechaVenc]  = useState("")
  const [fechaPago,  setFechaPago]  = useState("")
  const [subtotal,   setSubtotal]   = useState("")
  const [taxRate,    setTaxRate]    = useState("21")
  const [numero,     setNumero]     = useState("")
  const [notas,      setNotas]      = useState("")
  const [descripcion, setDescripcion] = useState("")

  // File replacement
  const [newFile,    setNewFile]    = useState<File | null>(null)
  const [existingFileName, setExistingFileName] = useState<string | null>(null)
  const [existingFileUrl,  setExistingFileUrl]  = useState<string | null>(null)

  // UI state
  const [fetchLoading, setFetchLoading] = useState(true)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [saved,        setSaved]        = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load existing document
  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError(err?.message ?? "Documento no encontrado"); setFetchLoading(false); return }
        const d = data as DocumentRow
        setTipo(d.document_type)
        setEmpresa(d.company_id ?? "")
        setEstado(d.status)
        setFecha(d.issue_date ?? "")
        setFechaVenc(d.due_date ?? "")
        setFechaPago(d.payment_date ?? "")
        setSubtotal(d.subtotal != null ? d.subtotal.toFixed(2).replace(".", ",") : d.total != null ? d.total.toFixed(2).replace(".", ",") : "")
        setTaxRate(d.tax_rate != null ? String(d.tax_rate) : "21")
        setNumero(d.document_number ?? "")
        setNotas(d.notes ?? "")
        setDescripcion(d.description ?? "")
        setExistingFileName(d.file_name)
        setExistingFileUrl(d.file_url)
        setFetchLoading(false)
      })
  }, [id])

  const computedTotal = (() => {
    const base = parseFloat(subtotal.replace(/\./g, "").replace(",", ".")) || 0
    const rate = parseFloat(taxRate) || 0
    return base + (base * rate) / 100
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrg) return
    setLoading(true); setError(null)

    try {
      const supabase = createClient()
      let fileUrl  = existingFileUrl
      let fileName = existingFileName
      let fileSize: number | null = null
      let fileType: string | null = null

      // Replace file if a new one was selected
      if (newFile) {
        const ext = newFile.name.split(".").pop() ?? "bin"
        const storagePath = `${currentOrg.id}/${crypto.randomUUID()}.${ext}`
        const { error: storageErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, newFile, { contentType: newFile.type, upsert: false })
        if (storageErr) {
          console.warn("Storage upload failed:", storageErr.message)
        } else {
          fileUrl  = storagePath
          fileName = newFile.name
          fileSize = newFile.size
          fileType = newFile.type
        }
      }

      const baseAmount = parseFloat(subtotal.replace(/\./g, "").replace(",", ".")) || null
      const rate       = parseFloat(taxRate) || 0
      const taxAmount  = baseAmount != null ? (baseAmount * rate) / 100 : null
      const total      = baseAmount != null ? baseAmount + (taxAmount ?? 0) : null

      const { error: updateErr } = await supabase
        .from("documents")
        .update({
          document_number: numero.trim() || null,
          document_type:   tipo as any,
          company_id:      empresa || null,
          status:          estado as any,
          subtotal:        baseAmount,
          tax_rate:        rate,
          tax_amount:      taxAmount,
          total:           total,
          issue_date:      fecha || null,
          due_date:        fechaVenc || null,
          payment_date:    fechaPago || null,
          notes:           notas.trim() || null,
          description:     descripcion.trim() || null,
          ...(newFile && { file_url: fileUrl, file_name: fileName, file_size: fileSize, file_type: fileType }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (updateErr) throw updateErr

      setSaved(true)
      setTimeout(() => router.push(`/factura/${id}`), 800)
    } catch (err: any) {
      setError(err?.message ?? "Error al guardar los cambios")
    } finally {
      setLoading(false)
    }
  }

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error && fetchLoading === false && !tipo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="w-10 h-10 text-destructive/50" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/biblioteca" className="text-sm text-primary hover:underline">{tCommon("back")}</Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/factura/${id}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {tCommon("back")}
        </Link>
        <div className="w-px h-4 bg-border" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Editar documento</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {numero ? `Nº ${numero}` : id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>

      {saved && (
        <div className="mb-6 flex items-center gap-2.5 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <p className="text-sm font-medium text-foreground">Cambios guardados correctamente</p>
        </div>
      )}

      {error && !saved && (
        <div className="mb-6 flex items-start gap-2.5 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-3 gap-6">
          {/* Main form */}
          <div className="col-span-2 space-y-5">

            {/* Document info */}
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
                  <input type="text" placeholder="FAC-2024-0001" value={numero}
                    onChange={e => setNumero(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    <Building2 className="w-3.5 h-3.5 inline mr-1" />{t("company")}
                  </label>
                  <div className="relative">
                    <select value={empresa} onChange={e => setEmpresa(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                      <option value="">{t("selectCompany")}</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{tFields("status")}</label>
                  <div className="relative">
                    <select value={estado} onChange={e => setEstado(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                      {DOC_STATUSES.map(k => <option key={k} value={k}>{tStatuses(k)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Fechas</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />{tFields("issueDate")}
                  </label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />{tFields("dueDate")}
                  </label>
                  <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />{tFields("paymentDate")}
                  </label>
                  <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground" />
                </div>
              </div>
            </div>

            {/* Amounts */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Importes</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Base imponible</label>
                  <div className="relative">
                    <input type="text" placeholder="0,00" value={subtotal} onChange={e => setSubtotal(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">% IVA</label>
                  <div className="relative">
                    <select value={taxRate} onChange={e => setTaxRate(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                      {["0","4","10","21"].map(v => <option key={v} value={v}>{v}%</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Total</label>
                  <div className="px-3 py-2.5 text-sm bg-muted/50 border border-border rounded-lg text-foreground font-semibold">
                    {computedTotal > 0 ? `${computedTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Notas y descripción</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{tFields("description")}</label>
                  <input type="text" placeholder="Descripción breve del documento" value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">{tFields("notes")}</label>
                  <textarea rows={3} placeholder={t("notesPlaceholder")} value={notas}
                    onChange={e => setNotas(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none leading-relaxed" />
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">

            {/* File */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">{tFields("file")}</h2>

              {existingFileName && !newFile && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{existingFileName}</span>
                </div>
              )}

              {newFile && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{newFile.name}</span>
                  <button type="button" onClick={() => setNewFile(null)} className="p-0.5 hover:bg-muted rounded">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}

              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
                onChange={e => { if (e.target.files?.[0]) setNewFile(e.target.files[0]) }} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-muted-foreground border border-dashed border-border rounded-lg hover:border-accent hover:text-accent transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {existingFileName ? "Reemplazar archivo" : "Subir archivo"}
              </button>
            </div>

            {/* Actions */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <button type="submit" disabled={loading || saved}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  : saved
                  ? <><CheckCircle2 className="w-4 h-4" /> Guardado</>
                  : <><Save className="w-4 h-4" /> Guardar cambios</>
                }
              </button>
              <Link href={`/factura/${id}`}
                className="w-full flex items-center justify-center py-2.5 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
                {tCommon("cancel")}
              </Link>
            </div>

            {/* Danger zone */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Zona de peligro</h2>
              <button type="button"
                onClick={async () => {
                  if (!confirm("¿Seguro que quieres marcar este documento como cancelado? No se eliminará, solo cambiará su estado.")) return
                  const supabase = createClient()
                  await supabase.from("documents").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id)
                  router.push(`/factura/${id}`)
                }}
                className="w-full text-xs text-destructive border border-destructive/30 rounded-lg py-2 hover:bg-destructive/5 transition-colors">
                Marcar como cancelado
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
