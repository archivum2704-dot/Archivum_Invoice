import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

/**
 * Inbound email webhook — provider-agnostic.
 *
 * Receives parsed-email payloads from a third-party inbound parser:
 *   - Resend Inbound      (resend)
 *   - Postmark Inbound    (postmark)
 *   - Mailgun Routes      (mailgun)
 *   - Cloudflare Workers  (custom — POST in this same shape)
 *
 * The route auto-detects the payload shape and normalises it into a
 * `ParsedEmail`. The `to` address is used to find the organization (the
 * local-part is the org's `inbox_token`). All PDF/image attachments are
 * uploaded to the `documents` bucket and a `documents` row is inserted
 * for each, with `document_type='pending'` so the existing AI extraction
 * pipeline can pick them up.
 *
 * Security:
 *   - INBOX_WEBHOOK_SECRET (header `x-archivum-webhook-secret`) shields the
 *     endpoint from unauthenticated calls. Configure it on whichever
 *     provider you use as a custom header.
 *   - Idempotency: the (provider, message_id) pair is unique in
 *     email_inbox_log — duplicate deliveries are skipped.
 */

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024 // 25 MB
const ALLOWED_MIME_PREFIXES = ["application/pdf", "image/"]
// Office / text formats accepted in addition to the prefixes above.
// Kept in sync with the 'documents' bucket allowed_mime_types (migration 20260623).
const ALLOWED_MIME_EXACT = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
])

function isAllowedMime(contentType: string): boolean {
  const mime = contentType.split(";")[0].trim().toLowerCase()
  return ALLOWED_MIME_PREFIXES.some(p => mime.startsWith(p)) || ALLOWED_MIME_EXACT.has(mime)
}

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface NormalisedAttachment {
  filename: string
  contentType: string
  /** Raw bytes (decoded from base64 / fetched from URL) */
  data: Buffer
}

interface ParsedEmail {
  provider: string
  messageId: string | null
  from: string
  to: string
  subject: string
  attachments: NormalisedAttachment[]
}

// ── Provider detection + normalisation ─────────────────────────────────────────

async function normalisePayload(req: NextRequest, body: any): Promise<ParsedEmail | null> {
  // Resend Inbound — { type: 'email.received', data: { from, to, subject, attachments: [{filename, content, contentType}] } }
  if (body?.type === "email.received" && body?.data) {
    const d = body.data
    return {
      provider: "resend",
      messageId: d.message_id ?? d.messageId ?? null,
      from: d.from?.[0]?.email ?? d.from ?? "",
      to: Array.isArray(d.to) ? (d.to[0]?.email ?? d.to[0]) : d.to ?? "",
      subject: d.subject ?? "",
      attachments: await decodeAttachments(d.attachments ?? [], "content"),
    }
  }

  // Postmark Inbound — flat object with FromFull, ToFull, Subject, Attachments[]
  if (body?.FromFull && body?.ToFull) {
    return {
      provider: "postmark",
      messageId: body.MessageID ?? null,
      from: body.FromFull.Email ?? "",
      to: body.ToFull?.[0]?.Email ?? body.OriginalRecipient ?? "",
      subject: body.Subject ?? "",
      attachments: await decodeAttachments(body.Attachments ?? [], "Content", "ContentType", "Name"),
    }
  }

  // Mailgun Routes — multipart/form-data, fields: from, recipient, subject,
  // attachment-count, attachment-1, attachment-2... (those are file fields).
  // Mailgun calls in form-data so we need to handle that case before reaching
  // here — see route handler below for that branch.

  // Generic shape: { from, to, subject, attachments: [{filename, content (base64), contentType}] }
  if (body?.from && body?.to) {
    return {
      provider: "generic",
      messageId: body.messageId ?? body.message_id ?? null,
      from: typeof body.from === "string" ? body.from : (body.from.email ?? ""),
      to:   typeof body.to   === "string" ? body.to   : (body.to.email   ?? ""),
      subject: body.subject ?? "",
      attachments: await decodeAttachments(body.attachments ?? [], "content"),
    }
  }

  return null
}

async function decodeAttachments(
  raw: any[],
  contentField = "content",
  typeField = "contentType",
  nameField = "filename",
): Promise<NormalisedAttachment[]> {
  const out: NormalisedAttachment[] = []
  for (const a of raw) {
    try {
      const filename = a[nameField] ?? a.Name ?? a.filename ?? "unnamed"
      const contentType = a[typeField] ?? a.ContentType ?? a.contentType ?? "application/octet-stream"
      let data: Buffer

      const content = a[contentField] ?? a.Content ?? a.content
      if (typeof content === "string") {
        // Base64
        data = Buffer.from(content, "base64")
      } else if (a.url) {
        // Some providers give a URL to fetch the binary
        const res = await fetch(a.url)
        const ab = await res.arrayBuffer()
        data = Buffer.from(ab)
      } else {
        continue
      }

      if (data.byteLength > MAX_ATTACHMENT_SIZE) continue
      if (!isAllowedMime(contentType)) continue

      out.push({ filename, contentType, data })
    } catch (e) {
      console.error("[inbox] failed to decode attachment", e)
    }
  }
  return out
}

// ── Address parsing ────────────────────────────────────────────────────────────

function extractToken(toAddress: string): string | null {
  // toAddress can be "Inbox <abc123@inbox.archivum.app>" or just "abc123@inbox.archivum.app"
  const match = toAddress.match(/<?([a-z0-9]+)@/i)
  return match?.[1]?.toLowerCase() ?? null
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Optional shared-secret check
  const requiredSecret = process.env.INBOX_WEBHOOK_SECRET
  if (requiredSecret) {
    const got = req.headers.get("x-archivum-webhook-secret")
    if (got !== requiredSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  let parsed: ParsedEmail | null = null

  // Mailgun (multipart/form-data) branch
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData()
    const from = (form.get("from") ?? form.get("sender") ?? "").toString()
    const to   = (form.get("recipient") ?? form.get("to") ?? "").toString()
    const subject = (form.get("subject") ?? "").toString()
    const messageId = (form.get("Message-Id") ?? form.get("message-id") ?? "").toString() || null

    const attachments: NormalisedAttachment[] = []
    const count = Number(form.get("attachment-count") ?? 0)
    for (let i = 1; i <= count; i++) {
      const file = form.get(`attachment-${i}`)
      if (file instanceof File) {
        if (file.size > MAX_ATTACHMENT_SIZE) continue
        if (!isAllowedMime(file.type)) continue
        attachments.push({
          filename: file.name,
          contentType: file.type,
          data: Buffer.from(await file.arrayBuffer()),
        })
      }
    }
    parsed = { provider: "mailgun", messageId, from, to, subject, attachments }
  } else {
    const body = await req.json()
    parsed = await normalisePayload(req, body)
  }

  if (!parsed) {
    console.warn("[inbox] could not parse payload")
    return NextResponse.json({ error: "unsupported_payload" }, { status: 400 })
  }

  const admin = getAdmin()
  const token = extractToken(parsed.to)

  // Insert log row (idempotent on (provider, messageId))
  let logId: string | null = null
  if (parsed.messageId) {
    const { data: existing } = await admin
      .from("email_inbox_log")
      .select("id, status")
      .eq("provider", parsed.provider)
      .eq("message_id", parsed.messageId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
  }

  const { data: logRow } = await admin.from("email_inbox_log").insert({
    provider:        parsed.provider,
    message_id:      parsed.messageId,
    from_address:    parsed.from,
    to_address:      parsed.to,
    subject:         parsed.subject,
    attachment_count: parsed.attachments.length,
    status:          "received",
    raw_payload:     null, // skip raw payload to avoid bloat; payloads are huge
  }).select("id").single()
  logId = logRow?.id ?? null

  if (!token) {
    if (logId) await admin.from("email_inbox_log").update({ status: "failed", error_message: "no_token" }).eq("id", logId)
    return NextResponse.json({ error: "no_token_in_address" }, { status: 200 })
  }

  // Find org by token
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("inbox_token", token)
    .single()

  if (!org) {
    if (logId) await admin.from("email_inbox_log").update({ status: "failed", error_message: "org_not_found" }).eq("id", logId)
    return NextResponse.json({ error: "org_not_found" }, { status: 200 })
  }

  if (logId) await admin.from("email_inbox_log").update({ organization_id: org.id }).eq("id", logId)

  if (parsed.attachments.length === 0) {
    if (logId) await admin.from("email_inbox_log").update({ status: "skipped", error_message: "no_attachments" }).eq("id", logId)
    return NextResponse.json({ ok: true, skipped: "no_attachments" })
  }

  // Process each attachment
  let createdCount = 0
  for (const att of parsed.attachments) {
    try {
      const ext = att.filename.split(".").pop() ?? "bin"
      const storagePath = `${org.id}/${crypto.randomUUID()}.${ext}`

      const { error: storageErr } = await admin.storage
        .from("documents")
        .upload(storagePath, att.data, { contentType: att.contentType, upsert: false })

      if (storageErr) {
        console.error("[inbox] storage upload failed:", storageErr.message)
        continue
      }

      const { error: insertErr } = await admin.from("documents").insert({
        organization_id: org.id,
        document_type:   "pending",     // AI pipeline can re-classify later
        status:          "pending",
        notes:           buildEmailNotes(parsed),
        file_url:        storagePath,
        file_name:       att.filename,
        file_size:       att.data.byteLength,
        file_type:       att.contentType,
      })

      if (insertErr) {
        console.error("[inbox] document insert failed:", insertErr.message)
        // Best-effort cleanup of orphan storage object
        await admin.storage.from("documents").remove([storagePath])
        continue
      }

      createdCount += 1
    } catch (err) {
      console.error("[inbox] unexpected error:", err)
    }
  }

  if (logId) {
    await admin.from("email_inbox_log").update({
      status: createdCount > 0 ? "processed" : "failed",
      documents_created: createdCount,
      error_message: createdCount === 0 ? "no_documents_created" : null,
    }).eq("id", logId)
  }

  return NextResponse.json({ ok: true, documents_created: createdCount })
}

function buildEmailNotes(p: ParsedEmail) {
  const lines = [
    `Importado por correo electrónico`,
    `De: ${p.from}`,
    `Asunto: ${p.subject || "(sin asunto)"}`,
  ]
  return lines.join("\n")
}

// Health check
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "inbox/webhook" })
}
