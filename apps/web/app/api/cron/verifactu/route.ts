import { NextResponse } from 'next/server'
import { adminClient, submitPendingForOrg } from '@/lib/verifactu-submit'
import { cronRequestIsAuthorised } from '@/lib/cron-auth'
import { runIntegrityCheck, recordEventSummary } from '@/lib/verifactu-integrity'

export const runtime = 'nodejs'
// Vercel Hobby caps this at 60 seconds; anything higher fails the build, not
// the request. Raise it here only together with the plan.
export const maxDuration = 60

/**
 * GET /api/cron/verifactu
 *
 * The one scheduled Verifactu job: submits what has not reached the AEAT, runs
 * the anomaly detection, and writes the event summary.
 *
 * These were three separate crons until the Hobby plan turned out to allow
 * two in total. They are combined here rather than dropped, and each still has
 * its own route for running on demand.
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
  if (!cronRequestIsAuthorised(request)) {
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

    // Integrity and the summary cover every organization that has ever
    // generated a record, not only those with something pending: art. 9.2 wants
    // the summary written even when nothing happened.
    const { data: allOrgs } = await db
      .from('verifactu_chain_links').select('organization_id').limit(20000)
    const everyOrg = Array.from(new Set((allOrgs ?? []).map((r: any) => r.organization_id))) as string[]

    let anomalies = 0
    for (const orgId of everyOrg) {
      try {
        const report = await runIntegrityCheck(db, orgId)
        anomalies += report.anomalies.length + report.eventAnomalies.length
        await recordEventSummary(db, orgId)
      } catch (err) {
        // One organization failing must not stop the rest being checked.
        console.error('[cron/verifactu] integrity', orgId, err)
      }
    }

    const sent = results.reduce((a, r) => a + Number(r.sent ?? 0), 0)
    const rejected = results.reduce((a, r) => a + Number(r.rejected ?? 0), 0)
    console.log(`[cron/verifactu] ${orgIds.length} orgs con pendientes, ${sent} enviadas, ${rejected} rechazadas, ${anomalies} anomalías`)
    if (anomalies > 0) console.error(`[cron/verifactu] ${anomalies} anomalías detectadas`)

    return NextResponse.json({ success: true, organizations: orgIds.length, sent, rejected, anomalies, results })
  } catch (err) {
    console.error('[cron/verifactu] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
