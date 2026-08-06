import type { RenderedDocument } from '@/lib/document-render'

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The email a client receives with their invoice, quote or delivery note.
 *
 * Plain and short on purpose: the PDF is the document, this is the covering
 * note. A sender's own message, when they write one, is shown above the
 * summary — escaped, since it is free text typed into the app.
 */
export function buildDocumentEmail(doc: RenderedDocument, message?: string | null): string {
  const capitalised = doc.label.charAt(0).toUpperCase() + doc.label.slice(1)
  const greeting = doc.clientName ? `Hola ${esc(doc.clientName)},` : 'Hola,'

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;">
      <p style="margin:0 0 16px;font-size:15px;">${greeting}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
        Te adjuntamos ${doc.label === 'albarán' ? 'el' : 'la'} ${esc(doc.label)}
        <strong>${esc(doc.fullNumber)}</strong>${doc.issuerName ? ` de ${esc(doc.issuerName)}` : ''}.
      </p>
      ${message?.trim() ? `<p style="margin:0 0 16px;padding:14px 16px;background:#f9fafb;border-left:3px solid #2E6FD6;border-radius:6px;font-size:14px;line-height:1.55;white-space:pre-wrap;">${esc(message.trim())}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 20px;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #f3f4f6;">${capitalised}</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;">${esc(doc.fullNumber)}</td>
        </tr>
        ${doc.issueDate ? `<tr>
          <td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #f3f4f6;">Fecha</td>
          <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f3f4f6;">${esc(doc.issueDate)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Total</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;font-size:16px;">${eur(doc.total)}</td>
        </tr>
      </table>
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
        Enviado con Archivum. Si no esperabas este correo, puedes ignorarlo.
      </p>
    </div>
  </body>
</html>`
}

/** Subject line: the document, its number, and who issued it. */
export function buildDocumentSubject(doc: RenderedDocument): string {
  const capitalised = doc.label.charAt(0).toUpperCase() + doc.label.slice(1)
  const from = doc.issuerName ? ` de ${doc.issuerName}` : ''
  return `${capitalised} ${doc.fullNumber}${from}`
}
