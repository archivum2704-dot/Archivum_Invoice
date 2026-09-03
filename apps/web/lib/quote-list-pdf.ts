import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatMoney } from '@/lib/currency'

export interface QuoteListItem {
  fullNumber: string
  clientName: string
  issueDate: string
  total: number
  currency?: string | null
}

export interface QuoteListPdfData {
  /** Switches the title between "Pedidos" and "Albaranes". */
  kind?: 'quote' | 'delivery_note'
  issuerName: string
  items: QuoteListItem[]
  /** When it was generated, shown in the header. */
  generatedAt: string
}

const NAVY = rgb(0.16, 0.22, 0.37)
const GREY = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.85, 0.86, 0.88)
const BOX = rgb(0.55, 0.58, 0.62)

/**
 * A checklist PDF: one row per pedido/albarán with an empty box to tick by
 * hand, meant to be printed and checked against the paperwork before billing
 * — not a replacement for each document's own PDF, which still exists.
 */
export async function buildQuoteListPdf(data: QuoteListPdfData): Promise<Uint8Array> {
  const TITLE = data.kind === 'delivery_note' ? 'LISTADO DE ALBARANES' : 'LISTADO DE PEDIDOS'
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const M = 50
  const pageSize: [number, number] = [595.28, 841.89]

  // WinAnsiEncoding (what pdf-lib's standard fonts use) covers Latin-1 plus
  // a few extras outside it, including € (used by formatMoney) — keep that
  // one explicitly, strip anything else non-Latin-1.
  const clean = (s: string) => (s ?? '').replace(/[^\x00-\xFF€]/g, '')

  let page = pdf.addPage(pageSize)
  let { width, height } = page.getSize()
  let y = height - M

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.12, 0.16)) =>
    page.drawText(clean(s), { x, y: yy, size, font: f, color })
  const right = (s: string, xRight: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.12, 0.16)) => {
    const c = clean(s)
    page.drawText(c, { x: xRight - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color })
  }

  const colBox = M + 18, colNum = M + 40, colClient = M + 150, colDate = width - M - 150, colTotal = width - M

  const drawHeader = () => {
    text(data.issuerName, M, y, 14, bold, NAVY)
    right(TITLE, width - M, y, 11, bold, GREY)
    y -= 16
    right(`Generado: ${data.generatedAt}`, width - M, y, 8, font, GREY)
    y -= 24

    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: LINE })
    y -= 14
    text('', colBox - 8, y, 8, bold, GREY)
    text('Nº', colNum, y, 8, bold, GREY)
    text('CLIENTE', colClient, y, 8, bold, GREY)
    text('FECHA', colDate, y, 8, bold, GREY)
    right('TOTAL', colTotal, y, 8, bold, GREY)
    y -= 8
    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: LINE })
    y -= 20
  }

  drawHeader()

  let count = 0
  for (const item of data.items) {
    if (y < M + 40) {
      page = pdf.addPage(pageSize)
      ;({ width, height } = page.getSize())
      y = height - M
      drawHeader()
    }

    // Empty checkbox to tick by hand.
    page.drawRectangle({
      x: colBox - 9, y: y - 1, width: 9, height: 9,
      borderWidth: 1, borderColor: BOX, color: rgb(1, 1, 1),
    })

    text(item.fullNumber, colNum, y, 9, bold)
    text(item.clientName.slice(0, 32), colClient, y, 9)
    text(item.issueDate, colDate, y, 9, font, GREY)
    right(formatMoney(item.total, item.currency ?? 'EUR'), colTotal, y, 9, bold)
    y -= 20
    count++
  }

  y -= 6
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: LINE })
  y -= 16
  text(`${count} documento${count === 1 ? '' : 's'}`, M, y, 9, font, GREY)
  // Adding amounts across currencies would be meaningless, so the grand
  // total only appears when every item is in the same one.
  const currencies = new Set(data.items.map(i => i.currency ?? 'EUR'))
  if (currencies.size === 1) {
    const grandTotal = data.items.reduce((acc, i) => acc + i.total, 0)
    right(`Total: ${formatMoney(grandTotal, data.items[0]?.currency ?? 'EUR')}`, colTotal, y, 10, bold, NAVY)
  }

  return await pdf.save()
}
