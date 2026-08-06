import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getApiClient } from '@/lib/supabase/api-auth'
import { renderDocument, type DocKind } from '@/lib/document-render'
import { buildDocumentEmail, buildDocumentSubject } from '@/lib/document-email'

export const runtime = 'nodejs'

const FROM_EMAIL = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

// Deliberately permissive: the point is to reject typos and obvious rubbish,
// not to police what a valid address may look like.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Email an invoice, quote or delivery note to its client, PDF attached.
 *
 * The document is rendered through the caller's own Supabase client, so RLS —
 * not this route — decides whether they may send it. Resend is only reached
 * once that read has succeeded.
 */
export async function POST(req: NextRequest) {
  try {
    const { kind, id, to, message } = await req.json() as {
      kind?: DocKind; id?: string; to?: string; message?: string
    }

    if (!id || (kind !== 'invoice' && kind !== 'quote')) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    const supabase = await getApiClient(req)
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const doc = await renderDocument(supabase, kind, id)
    if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const recipient = (to ?? doc.clientEmail ?? '').trim()
    if (!recipient) {
      return NextResponse.json({
        error: 'no_recipient',
        detail: 'Este cliente no tiene correo guardado. Añádelo en su ficha o escríbelo al enviar.',
      }, { status: 422 })
    }
    if (!EMAIL_RE.test(recipient)) {
      return NextResponse.json({ error: 'invalid_email', detail: 'La dirección de correo no es válida.' }, { status: 422 })
    }

    const key = process.env.RESEND_API_KEY
    if (!key) {
      return NextResponse.json({
        error: 'email_not_configured',
        detail: 'El envío de correo no está configurado en el servidor (falta RESEND_API_KEY).',
      }, { status: 503 })
    }

    const { error: sendErr } = await new Resend(key).emails.send({
      from: FROM_EMAIL,
      to: recipient,
      replyTo: user.email ?? undefined,
      subject: buildDocumentSubject(doc),
      html: buildDocumentEmail(doc, message),
      attachments: [{ filename: doc.filename, content: Buffer.from(doc.bytes).toString('base64') }],
    })
    if (sendErr) {
      console.error('[documents/email] Resend error:', sendErr)
      return NextResponse.json({ error: 'send_failed', detail: sendErr.message }, { status: 502 })
    }

    return NextResponse.json({ success: true, to: recipient })
  } catch (err) {
    console.error('[documents/email] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
