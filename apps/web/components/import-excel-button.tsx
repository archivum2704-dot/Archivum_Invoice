"use client"

import { useRef, useState } from "react"
import { FileSpreadsheet, Download, Upload, X, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"

type Kind = "clients" | "products"
type Stage = "pick" | "review" | "done"

interface RowError {
  row: number
  message: string
}

interface ColumnDef {
  key: string
  header: string
  required?: boolean
}

/**
 * Bulk import of clients or inventory items from an Excel/CSV file.
 *
 * Column-mapping is deliberately fixed to the downloadable template rather
 * than a free-form mapper: matching by exact (localized) header text keeps
 * both the UI and the validation logic simple, at the cost of requiring the
 * user to keep the template's column names.
 */
export function ImportExcelButton({ kind, orgId, onImported }: {
  kind: Kind
  orgId: string | null
  onImported: () => void
}) {
  const t = useTranslations("importExcel")
  const tInv = useTranslations("invoicing")
  const tProd = useTranslations("inventory")

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<Stage>("pick")
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [errors, setErrors] = useState<RowError[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [resultCount, setResultCount] = useState(0)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const kindLabel = kind === "clients" ? t("kindClients") : t("kindProducts")

  const columns: ColumnDef[] = kind === "clients"
    ? [
        { key: "name", header: tInv("clientName"), required: true },
        { key: "cif", header: tInv("clientTaxId") },
        { key: "email", header: tInv("clientEmail") },
        { key: "phone", header: tInv("clientPhone") },
        { key: "address", header: tInv("clientAddress") },
        { key: "postal_code", header: tInv("clientPostalCode") },
        { key: "city", header: tInv("clientCity") },
        { key: "province", header: tInv("clientProvince") },
        { key: "country_code", header: tInv("clientCountry") },
      ]
    : [
        { key: "name", header: tProd("name"), required: true },
        { key: "sku", header: tProd("sku") },
        { key: "category", header: tProd("category") },
        { key: "description", header: tProd("description") },
        { key: "unit", header: tProd("unit") },
        { key: "unit_price", header: `${tProd("unitPrice")} (€)` },
        { key: "tax_rate", header: `${tProd("tax")} (%)` },
        { key: "stock_qty", header: tProd("stock") },
        { key: "min_stock", header: tProd("minStock") },
      ]

  const reset = () => {
    setStage("pick"); setRows(null); setErrors([]); setFatalError(null); setBusy(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const close = () => {
    if (busy) return
    setOpen(false)
    reset()
  }

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx")
    const exampleRow: Record<string, string> = {}
    for (const c of columns) exampleRow[c.header] = ""
    const ws = XLSX.utils.json_to_sheet([exampleRow])
    ws["!cols"] = columns.map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, kindLabel)
    XLSX.writeFile(wb, `plantilla_${kind === "clients" ? "clientes" : "inventario"}.xlsx`)
  }

  // Blank -> null (field not supplied). Otherwise a finite number, or NaN if unparsable.
  const parseNumber = (v: string): number | null => {
    if (v.trim() === "") return null
    const n = Number(v.trim().replace(",", "."))
    return Number.isFinite(n) ? n : NaN
  }

  const handleFile = async (file: File) => {
    setBusy(true); setFatalError(null)
    try {
      const XLSX = await import("xlsx")
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

      if (json.length === 0) { setFatalError(t("emptyFile")); setBusy(false); return }

      const requiredCol = columns.find((c) => c.required)!
      const firstRowKeys = Object.keys(json[0]).map((k) => k.trim())
      if (!firstRowKeys.includes(requiredCol.header)) {
        setFatalError(t("missingHeaders")); setBusy(false); return
      }

      const validRows: Record<string, unknown>[] = []
      const rowErrors: RowError[] = []

      json.forEach((raw, i) => {
        const rowNum = i + 2 // header occupies row 1
        const get = (header: string): string => {
          const key = Object.keys(raw).find((k) => k.trim() === header)
          const value = key ? raw[key] : ""
          return value == null ? "" : String(value).trim()
        }

        if (kind === "clients") {
          const name = get(tInv("clientName"))
          if (!name) { rowErrors.push({ row: rowNum, message: t("requiredFieldMissing") }); return }

          const email = get(tInv("clientEmail"))
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            rowErrors.push({ row: rowNum, message: t("invalidEmail") }); return
          }

          const country = (get(tInv("clientCountry")) || "ES").toUpperCase()
          if (country.length !== 2) {
            rowErrors.push({ row: rowNum, message: t("invalidCountry") }); return
          }

          validRows.push({
            id: crypto.randomUUID(),
            organization_id: orgId,
            name,
            cif: get(tInv("clientTaxId")) || null,
            email: email || null,
            phone: get(tInv("clientPhone")) || null,
            address: get(tInv("clientAddress")) || null,
            postal_code: get(tInv("clientPostalCode")) || null,
            city: get(tInv("clientCity")) || null,
            province: get(tInv("clientProvince")) || null,
            country_code: country,
            tax_id_type: null,
            is_active: true,
          })
        } else {
          const name = get(tProd("name"))
          if (!name) { rowErrors.push({ row: rowNum, message: t("requiredFieldMissing") }); return }

          const priceRaw = get(`${tProd("unitPrice")} (€)`)
          const price = parseNumber(priceRaw)
          if (Number.isNaN(price)) { rowErrors.push({ row: rowNum, message: t("invalidNumber", { value: priceRaw }) }); return }

          const taxRaw = get(`${tProd("tax")} (%)`)
          const taxRate = parseNumber(taxRaw)
          if (Number.isNaN(taxRate)) { rowErrors.push({ row: rowNum, message: t("invalidNumber", { value: taxRaw }) }); return }

          const stockRaw = get(tProd("stock"))
          const stockQty = parseNumber(stockRaw)
          if (Number.isNaN(stockQty)) { rowErrors.push({ row: rowNum, message: t("invalidNumber", { value: stockRaw }) }); return }

          const minStockRaw = get(tProd("minStock"))
          const minStock = parseNumber(minStockRaw)
          if (Number.isNaN(minStock)) { rowErrors.push({ row: rowNum, message: t("invalidNumber", { value: minStockRaw }) }); return }

          validRows.push({
            organization_id: orgId,
            name,
            sku: get(tProd("sku")) || null,
            category: get(tProd("category")) || null,
            description: get(tProd("description")) || null,
            unit: get(tProd("unit")) || "ud",
            unit_price: price ?? 0,
            tax_rate: taxRate ?? 21,
            track_stock: stockQty !== null,
            stock_qty: stockQty ?? 0,
            min_stock: minStock,
          })
        }
      })

      setTotalRows(json.length)
      setRows(validRows)
      setErrors(rowErrors)
      setStage("review")
    } catch (e) {
      setFatalError(t("errorGeneric", { message: e instanceof Error ? e.message : "" }))
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async () => {
    if (!rows || rows.length === 0 || !orgId) return
    setBusy(true); setFatalError(null)
    const supabase = createClient()
    const table = kind === "clients" ? "companies" : "products"
    const { error } = await supabase.from(table).insert(rows)
    setBusy(false)
    if (error) { setFatalError(t("errorGeneric", { message: error.message })); return }
    setResultCount(rows.length)
    setStage("done")
    onImported()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors"
      >
        <FileSpreadsheet className="w-4 h-4" />
        {t("title")}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
              <button onClick={close} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {stage === "pick" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("intro", { kind: kindLabel })}</p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-muted text-foreground text-sm font-medium rounded-xl hover:bg-muted/70 transition-colors"
                >
                  <Download className="w-4 h-4" /> {t("downloadTemplate")}
                </button>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground text-center">{t("dropHint")}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  />
                </label>
                {busy && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t("parsing")}
                  </div>
                )}
                {fatalError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-destructive text-sm">{fatalError}</p>
                  </div>
                )}
              </div>
            )}

            {stage === "review" && rows && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-sm text-foreground">{t("summaryValid", { valid: rows.length, total: totalRows })}</p>
                </div>
                {errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 bg-destructive/5 border border-destructive/15 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                        <p className="text-xs text-destructive">{t("rowError", { row: e.row, message: e.message })}</p>
                      </div>
                    ))}
                  </div>
                )}
                {fatalError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-destructive text-sm">{fatalError}</p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button onClick={reset} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    {t("back")}
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={busy || rows.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t("confirmImport", { count: rows.length })}
                  </button>
                </div>
              </div>
            )}

            {stage === "done" && (
              <div className="space-y-4 text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
                <p className="text-sm text-foreground">{t("importSuccess", { count: resultCount, kind: kindLabel })}</p>
                <button
                  onClick={close}
                  className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
                >
                  {t("closeButton")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
