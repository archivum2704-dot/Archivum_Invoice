import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildSubmissionXml } from '@/lib/verifactu-xml'
import { submitToAeat, type StoredCertificate } from '@/lib/verifactu-client'
import { missingProducerConfig } from '@/lib/verifactu'

/**
 * Submitting issued invoices to the AEAT.
 *
 * Runs with the service role throughout, for two reasons: the certificate
 * table denies all client access by design, and submission is not a user
 * action — the cron sweep has no user at all. Callers are responsible for
 * having checked who asked.
 *
 * The guiding rule is that an unsent record stays an obligation. Nothing here
 * ever discards one: a rejection is recorded against the invoice and left for
 * a human to look at, and a transport failure is simply retried later.
 */

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service env')
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export interface SubmitOutcome {
  attempted: number
  sent: number
  rejected: number
  /** Nothing was attempted, and why — not configured, nothing pending, waiting. */
  skipped: string | null
  error: string | null
}

const BATCH_SIZE = 100

/**
 * Submit an organization's outstanding records.
 *
 * Batched well below the AEAT's 1000 because a batch is all-or-nothing at the
 * transport level: a smaller one loses less work to a timeout and gets a
 * rejected record in front of someone sooner.
 */
export async function submitPendingForOrg(orgId: string, opts: { invoiceId?: string } = {}): Promise<SubmitOutcome> {
  const db: any = adminClient()
  const nothing = (skipped: string): SubmitOutcome =>
    ({ attempted: 0, sent: 0, rejected: 0, skipped, error: null })

  const missing = missingProducerConfig()
  if (missing.length) return nothing(`Falta configurar ${missing.join(', ')}`)

  const { data: org } = await db
    .from('organizations')
    .select('id, name, cif, verifactu_retry_after')
    .eq('id', orgId).single()
  if (!org) return nothing('Organización no encontrada')
  if (!org.cif?.trim()) return nothing('La organización no tiene CIF')

  // Flow control: the AEAT told us when it would accept the next submission.
  if (org.verifactu_retry_after && new Date(org.verifactu_retry_after) > new Date()) {
    return nothing(`La AEAT pidió esperar hasta ${org.verifactu_retry_after}`)
  }

  const { data: cert } = await db
    .from('org_certificates')
    .select('cert_cipher, cert_iv, cert_tag, pass_cipher, pass_iv, pass_tag')
    .eq('organization_id', orgId).maybeSingle()
  if (!cert) return nothing('La organización no tiene certificado digital')

  let query = db
    .from('invoices')
    .select('id, full_number, registro_alta, aeat_attempts')
    .eq('organization_id', orgId)
    .eq('state', 'issued')
    .not('registro_alta', 'is', null)
    .in('verifactu_status', ['generated', 'error'])
    .order('issued_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (opts.invoiceId) query = query.eq('id', opts.invoiceId)

  const { data: pending } = await query
  if (!pending?.length) return nothing('No hay registros pendientes')

  // Order matters beyond tidiness: the records form a chain, and the AEAT
  // expects them in the order they were issued.
  const xml = buildSubmissionXml(
    { nombreRazon: org.name, nif: org.cif.trim() },
    pending.map((i: any) => i.registro_alta),
  )

  const attemptedAt = new Date().toISOString()
  const result = await submitToAeat(xml, cert as StoredCertificate)

  // A transport failure says nothing about the records themselves, so they
  // stay exactly as they were, only counted and dated.
  if (!result.ok || !result.response) {
    await Promise.all(pending.map((i: any) => db.from('invoices').update({
      verifactu_status: 'error',
      aeat_attempts: (i.aeat_attempts ?? 0) + 1,
      aeat_last_attempt_at: attemptedAt,
      aeat_error: result.error ?? `HTTP ${result.httpStatus}`,
    }).eq('id', i.id)))
    return { attempted: pending.length, sent: 0, rejected: 0, skipped: null, error: result.error ?? `HTTP ${result.httpStatus}` }
  }

  const res = result.response
  if (res.tiempoEsperaSegundos) {
    await db.from('organizations').update({
      verifactu_retry_after: new Date(Date.now() + res.tiempoEsperaSegundos * 1000).toISOString(),
    }).eq('id', orgId)
  }

  // Per-record outcome, matched on the invoice number the AEAT echoes back.
  const byNumber = new Map(res.lineas.map(l => [l.numSerieFactura, l]))
  let sent = 0, rejected = 0

  await Promise.all(pending.map(async (i: any) => {
    const linea = byNumber.get(i.full_number)
    // No line for this record: the AEAT accepted the envelope but said nothing
    // about it. Treated as unconfirmed, never as sent.
    const accepted = linea
      ? linea.estado === 'Correcto' || linea.estado === 'AceptadoConErrores'
      : false

    if (accepted) sent++
    else if (linea) rejected++

    await db.from('invoices').update({
      verifactu_status: accepted ? 'sent' : 'error',
      aeat_csv: accepted ? res.csv : null,
      aeat_response: { estadoEnvio: res.estadoEnvio, csv: res.csv, linea: linea ?? null },
      submitted_at: accepted ? attemptedAt : null,
      aeat_attempts: (i.aeat_attempts ?? 0) + 1,
      aeat_last_attempt_at: attemptedAt,
      aeat_error: accepted
        ? null
        : linea
          ? `${linea.codigoError ?? ''} ${linea.descripcionError ?? ''}`.trim() || 'Rechazado por la AEAT'
          : 'La AEAT no devolvió respuesta para esta factura',
    }).eq('id', i.id)
  }))

  return { attempted: pending.length, sent, rejected, skipped: null, error: null }
}
