import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

export interface InvoicePdfLine {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
}

export interface InvoicePdfData {
  fullNumber: string
  issueDate: string
  dueDate?: string | null
  issuer: { name: string; cif?: string | null; address?: string | null; postalCode?: string | null; city?: string | null; province?: string | null }
  client: { name: string; cif?: string | null; address?: string | null; postalCode?: string | null; city?: string | null; province?: string | null }
  lines: InvoicePdfLine[]
  subtotal: number
  taxAmount: number
  total: number
  notes?: string | null
  huella: string
  qrUrl: string
}

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`
const NAVY = rgb(0.16, 0.22, 0.37)
const GREY = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.85, 0.86, 0.88)

/** Builds an A4 PDF of the issued invoice with the Verifactu QR + huella. */
export async function buildInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const M = 50
  let y = height - M

  // Standard fonts only support WinAnsi — drop anything outside it (emoji, CJK…)
  const clean = (s: string) => (s ?? '').replace(/[^\x00-\xFF]/g, '')
  const text = (s: string, x: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.12, 0.16)) =>
    page.drawText(clean(s), { x, y: yy, size, font: f, color })
  const right = (s: string, xRight: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.12, 0.16)) => {
    const c = clean(s)
    page.drawText(c, { x: xRight - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color })
  }

  // ── Header: issuer + invoice meta ──
  text(data.issuer.name, M, y, 16, bold, NAVY)
  right('FACTURA', width - M, y, 12, bold, GREY)
  y -= 16
  right(data.fullNumber, width - M, y, 14, bold, NAVY)
  y -= 14
  const issuerLines = [
    data.issuer.cif ? `CIF: ${data.issuer.cif}` : '',
    data.issuer.address ?? '',
    [data.issuer.postalCode, data.issuer.city, data.issuer.province].filter(Boolean).join(' · '),
  ].filter(Boolean)
  for (const l of issuerLines) { text(l, M, y, 9, font, GREY); y -= 12 }
  right(`Fecha: ${data.issueDate}`, width - M, y + (issuerLines.length * 12) - 12, 9, font, GREY)
  if (data.dueDate) right(`Vencimiento: ${data.dueDate}`, width - M, y + (issuerLines.length * 12) - 24, 9, font, GREY)

  y -= 18

  // ── Client ──
  text('FACTURAR A', M, y, 8, bold, GREY); y -= 14
  text(data.client.name, M, y, 11, bold); y -= 13
  const clientLines = [
    data.client.cif ? `CIF: ${data.client.cif}` : '',
    data.client.address ?? '',
    [data.client.postalCode, data.client.city, data.client.province].filter(Boolean).join(' · '),
  ].filter(Boolean)
  for (const l of clientLines) { text(l, M, y, 9, font, GREY); y -= 12 }

  y -= 14

  // ── Lines table ──
  const colQty = width - M - 230, colPrice = width - M - 150, colTax = width - M - 70, colTotal = width - M
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: LINE })
  y -= 14
  text('DESCRIPCIÓN', M, y, 8, bold, GREY)
  right('CANT.', colQty + 30, y, 8, bold, GREY)
  right('PRECIO', colPrice + 40, y, 8, bold, GREY)
  right('IVA', colTax + 20, y, 8, bold, GREY)
  right('TOTAL', colTotal, y, 8, bold, GREY)
  y -= 8
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: LINE })
  y -= 16

  for (const l of data.lines) {
    text(l.description.slice(0, 60), M, y, 9)
    right(String(l.quantity), colQty + 30, y, 9, font, GREY)
    right(eur(l.unit_price), colPrice + 40, y, 9, font, GREY)
    right(`${l.tax_rate}%`, colTax + 20, y, 9, font, GREY)
    right(eur(l.line_total), colTotal, y, 9, bold)
    y -= 16
    if (y < 160) { y = height - M } // naive overflow guard (single page expected)
  }

  // ── Totals ──
  y -= 6
  page.drawLine({ start: { x: width - M - 200, y }, end: { x: width - M, y }, thickness: 0.5, color: LINE })
  y -= 16
  text('Base imponible', width - M - 200, y, 9, font, GREY); right(eur(data.subtotal), colTotal, y, 9); y -= 14
  text('IVA', width - M - 200, y, 9, font, GREY); right(eur(data.taxAmount), colTotal, y, 9); y -= 16
  text('TOTAL', width - M - 200, y, 11, bold, NAVY); right(eur(data.total), colTotal, y, 11, bold, NAVY)

  y -= 30
  if (data.notes) { text(data.notes.slice(0, 120), M, y, 8, font, GREY); y -= 20 }

  // ── Verifactu block (bottom) ──
  const qrPng = await QRCode.toBuffer(data.qrUrl, { width: 120, margin: 1 })
  const qrImg = await pdf.embedPng(qrPng)
  const qrSize = 90
  page.drawImage(qrImg, { x: width - M - qrSize, y: M, width: qrSize, height: qrSize })
  text('VERI*FACTU', M, M + 70, 11, bold, NAVY)
  text('Factura verificable en la Sede electrónica de la AEAT', M, M + 56, 8, font, GREY)
  text('Huella:', M, M + 38, 7, bold, GREY)
  text(data.huella.slice(0, 64), M, M + 28, 6, font, GREY)

  return await pdf.save()
}
