import { NextResponse } from 'next/server'
import { adminClient, submitPendingForOrg } from '@/lib/verifactu-submit'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * GET /api/cron/verifactu
 *
 * Sweeps every organization with unsent records and submits them.
 *
 * Veri*Factu expects records to reach the AEAT promptly after issue, and
 * issuing already attempts it inline — this is the safety net for the ones
 * that did not get through: the AEAT was down, the certificate had expired,
 * the network failed. It is what stops a failure from becoming a permanently
 * missing record simply because nobody looked.
 *
 * Protected by CRON_SECRET, which Vercel sends as a bearer token.
 */
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db: any = adminClient()

    // Organizations holding something unsent. Read as a set of ids so an
    // organization with 500 pending records is still visited once.
    const { data: rows, error } = await db
      .from('invoices')
      .select('organization_id')
      .eq('state', 'issued')
      .in('verifactu_status', ['generated', 'error'])
      .not('registro_alta', 'is', null)
      .limit(5000)
    if (error) throw error

    const orgIds = Array.from(new Set((rows ?? []).map((r: any) => r.organization_id)))
    const results: Record<string, unknown>[] = []

    // Sequential on purpose: the AEAT applies flow control per caller, and
    // firing every organization at once is how you get throttled.
    for (const orgId of orgIds) {
      try {
        const outcome = await submitPendingForOrg(orgId as string)
        results.push({ orgId, ...outcome })
      } catch (err) {
        results.push({ orgId, error: String(err) })
      }
    }

    const sent = results.reduce((a, r) => a + Number(r.sent ?? 0), 0)
    const rejected = results.reduce((a, r) => a + Number(r.rejected ?? 0), 0)
    console.log(`[cron/verifactu] ${orgIds.length} orgs, ${sent} enviadas, ${rejected} rechazadas`)

    return NextResponse.json({ success: true, organizations: orgIds.length, sent, rejected, results })
  } catch (err) {
    console.error('[cron/verifactu] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
