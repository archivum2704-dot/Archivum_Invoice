import type { Document } from "@/lib/hooks/use-documents"

type Labels = {
  number: string
  type: string
  company: string
  cif: string
  status: string
  subtotal: string
  taxRate: string
  taxAmount: string
  total: string
  currency: string
  issueDate: string
  dueDate: string
  paymentDate: string
  description: string
  notes: string
}

type TypeLabel = (key: string) => string
type StatusLabel = (key: string) => string

function buildRows(
  docs: Document[],
  labels: Labels,
  tType: TypeLabel,
  tStatus: StatusLabel,
) {
  const fmt = (v: string | null | undefined) => v ?? ""
  const fmtDate = (v: string | null | undefined) =>
    v ? new Date(v).toLocaleDateString("es-ES") : ""
  const fmtNum = (v: number | null | undefined) =>
    v != null ? v.toFixed(2) : ""

  const header = [
    labels.number,
    labels.type,
    labels.company,
    labels.cif,
    labels.status,
    labels.subtotal,
    labels.taxRate,
    labels.taxAmount,
    labels.total,
    labels.currency,
    labels.issueDate,
    labels.dueDate,
    labels.paymentDate,
    labels.description,
    labels.notes,
  ]

  const rows = docs.map((d) => [
    fmt(d.document_number),
    tType(d.document_type),
    d.company?.name ?? "",
    d.company?.cif ?? "",
    tStatus(d.status),
    fmtNum(d.subtotal),
    d.tax_rate != null ? `${d.tax_rate}%` : "",
    fmtNum(d.tax_amount),
    fmtNum(d.total),
    d.currency,
    fmtDate(d.issue_date),
    fmtDate(d.due_date),
    fmtDate(d.payment_date),
    fmt(d.description),
    fmt(d.notes),
  ])

  return [header, ...rows]
}

// ── CSV ──────────────────────────────────────────────────────────────────────
function escapeCSV(cell: string) {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`
  }
  return cell
}

export function downloadCSV(
  docs: Document[],
  labels: Labels,
  tType: TypeLabel,
  tStatus: StatusLabel,
  filename = "facturas.csv",
) {
  const rows = buildRows(docs, labels, tType, tStatus)
  const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\r\n")
  // UTF-8 BOM so Excel opens with correct encoding
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  triggerDownload(blob, filename)
}

// ── Excel (.xls via HTML table — zero dependencies) ──────────────────────────
export function downloadExcel(
  docs: Document[],
  labels: Labels,
  tType: TypeLabel,
  tStatus: StatusLabel,
  filename = "facturas.xls",
) {
  const rows = buildRows(docs, labels, tType, tStatus)

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const [header, ...dataRows] = rows

  const thCells = header.map((h) => `<th style="background:#f3f4f6;font-weight:bold;border:1px solid #d1d5db;padding:6px 10px;">${esc(h)}</th>`).join("")
  const tdRows = dataRows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td style="border:1px solid #e5e7eb;padding:5px 10px;">${esc(c)}</td>`).join("")}</tr>`,
    )
    .join("\n")

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Facturas</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body>
<table>
  <thead><tr>${thCells}</tr></thead>
  <tbody>${tdRows}</tbody>
</table>
</body></html>`

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" })
  triggerDownload(blob, filename)
}

// ── Helper ────────────────────────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
