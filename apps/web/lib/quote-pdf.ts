import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatMoney, needsExchangeRate, toEur } from '@/lib/currency'

export interface QuotePdfLine {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
}

export interface QuotePdfData {
  /** Switches the wording between a quote and a delivery note. */
  kind?: 'quote' | 'delivery_note'
  fullNumber: string
  issueDate: string
  validUntil?: string | null
  issuer: { name: string; cif?: string | null; address?: string | null; postalCode?: string | null; city?: string | null; province?: string | null; logoUrl?: string | null }
  client: { name: string; cif?: string | null; address?: string | null; postalCode?: string | null; city?: string | null; province?: string | null }
  lines: QuotePdfLine[]
  subtotal: number
  discountPct?: number | null
  discountAmount?: number
  taxAmount: number
  retentionPct?: number | null
  retentionAmount?: number
  total: number
  notes?: string | null
  /** ISO 4217. Por defecto EUR. */
  currency?: string | null
  /** Euros por 1 unidad de `currency`. */
  exchangeRate?: number | null
}

const NAVY = rgb(0.16, 0.22, 0.37)
const GREY = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.85, 0.86, 0.88)

/** Builds an A4 PDF of a quote (presupuesto) — same look as an invoice, no Verifactu. */
export async function buildQuotePdf(data: QuotePdfData): Promise<Uint8Array> {
  // Delivery notes reuse this layout; only the wording changes.
  const DOC = data.kind === 'delivery_note' ? 'ALBARÁN' : 'PEDIDO'
  const FOR = data.kind === 'delivery_note' ? 'ALBARÁN PARA' : 'PEDIDO PARA'
  const currency = data.currency || 'EUR'
  const eur = (n: number) => formatMoney(n, currency)
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const M = 50
  let y = height - M

  const clean = (s: string) => (s ?? '').replace(/[^\x00-\xFF]/g, '')
  const text = (s: string, x: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.12, 0.16)) =>
    page.drawText(clean(s), { x, y: yy, size, font: f, color })
  const right = (s: string, xRight: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.12, 0.16)) => {
    const c = clean(s)
    page.drawText(c, { x: xRight - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color })
  }

  // Logo (best-effort)
  let textX = M
  const logoSize = 48
  if (data.issuer.logoUrl) {
    try {
      const res = await fetch(data.issuer.logoUrl)
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') ?? ''
        const img = contentType.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
        const scale = logoSize / Math.max(img.width, img.height)
        const w = img.width * scale, h = img.height * scale
        page.drawImage(img, { x: M, y: y - logoSize + (logoSize - h), width: w, height: h })
        textX = M + logoSize + 12
      }
    } catch (e) {
      console.warn('[quote-pdf] logo embed failed (non-fatal):', e)
    }
  }

  // Header
  text(data.issuer.name, textX, y, 16, bold, NAVY)
  right(DOC, width - M, y, 12, bold, GREY)
  y -= 16
  right(data.fullNumber, width - M, y, 14, bold, NAVY)
  y -= 14
  const issuerLines = [
    data.issuer.cif ? `CIF: ${data.issuer.cif}` : '',
    data.issuer.address ?? '',
    [data.issuer.postalCode, data.issuer.city, data.issuer.province].filter(Boolean).join(' · '),
  ].filter(Boolean)
  for (const l of issuerLines) { text(l, textX, y, 9, font, GREY); y -= 12 }
  right(`Fecha: ${data.issueDate}`, width - M, y + (issuerLines.length * 12) - 12, 9, font, GREY)
  if (data.validUntil) right(`Válido hasta: ${data.validUntil}`, width - M, y + (issuerLines.length * 12) - 24, 9, font, GREY)

  y -= 18

  // Client
  text(FOR, M, y, 8, bold, GREY); y -= 14
  text(data.client.name, M, y, 11, bold); y -= 13
  const clientLines = [
    data.client.cif ? `CIF: ${data.client.cif}` : '',
    data.client.address ?? '',
    [data.client.postalCode, data.client.city, data.client.province].filter(Boolean).join(' · '),
  ].filter(Boolean)
  for (const l of clientLines) { text(l, M, y, 9, font, GREY); y -= 12 }

  y -= 14

  // Lines table
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
    if (y < 140) { y = height - M }
  }

  // Totals
  y -= 6
  page.drawLine({ start: { x: width - M - 200, y }, end: { x: width - M, y }, thickness: 0.5, color: LINE })
  y -= 16
  text('Base imponible', width - M - 200, y, 9, font, GREY); right(eur(data.subtotal), colTotal, y, 9); y -= 14
  if (data.discountAmount && data.discountAmount !== 0) {
    text(`Descuento (${data.discountPct ?? 0}%)`, width - M - 200, y, 9, font, GREY)
    right(`-${eur(data.discountAmount)}`, colTotal, y, 9); y -= 14
  }
  text('IVA', width - M - 200, y, 9, font, GREY); right(eur(data.taxAmount), colTotal, y, 9); y -= 14
  if (data.retentionAmount && data.retentionAmount !== 0) {
    text(`Retención IRPF (${data.retentionPct ?? 0}%)`, width - M - 200, y, 9, font, GREY)
    right(`-${eur(data.retentionAmount)}`, colTotal, y, 9); y -= 14
  }
  y -= 2
  text('TOTAL', width - M - 200, y, 11, bold, NAVY); right(eur(data.total), colTotal, y, 11, bold, NAVY)

  if (needsExchangeRate(currency) && data.exchangeRate) {
    y -= 18
    text(
      `Tipo de cambio: 1 ${currency} = ${data.exchangeRate.toFixed(4).replace('.', ',')} € · Equivalente: ${formatMoney(toEur(data.total, currency, data.exchangeRate), 'EUR')}`,
      M, y, 7, font, GREY,
    )
  }

  y -= 30
  if (data.notes) { text(data.notes.slice(0, 160), M, y, 8, font, GREY); y -= 20 }

  // Footer disclaimer (this is a quote, not an invoice)
  text(DOC, M, M + 24, 10, bold, NAVY)
  text('Este documento es un pedido y no tiene validez como factura.', M, M + 12, 8, font, GREY)

  return await pdf.save()
}
