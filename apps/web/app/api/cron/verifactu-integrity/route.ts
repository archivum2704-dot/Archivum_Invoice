import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/verifactu-submit'
import { cronRequestIsAuthorised } from '@/lib/cron-auth'
import { runIntegrityCheck, recordEventSummary } from '@/lib/verifactu-integrity'

export const runtime = 'nodejs'
// Vercel Hobby caps this at 60 seconds; anything higher fails the build, not
// the request. Raise it here only together with the plan.
export const maxDuration = 60

/**
 * GET /api/cron/verifactu-integrity — every six hours.
 *
 * Runs the anomaly detection the Orden requires (art. 9.1.c-f) and writes the
 * six-hourly summary event (art. 9.2). Both belong on the same schedule: the
 * summary attests to a period, and a period nobody checked is a weaker thing
 * to attest to.
 *
 * Every organization that has generated a record is visited, including the
 * quiet ones — art. 9.2 requires the summary even when nothing happened.
 */
export async function GET(request: Request) {
  if (!cronRequestIsAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db: any = adminClient()

    const { data: rows, error } = await db
      .from('verifactu_chain_links').select('organization_id').limit(20000)
    if (error) throw error

    const orgIds = Array.from(new Set((rows ?? []).map((r: any) => r.organization_id))) as string[]
    const results: Record<string, unknown>[] = []

    for (const orgId of orgIds) {
      try {
        const report = await runIntegrityCheck(db, orgId)
        await recordEventSummary(db, orgId)
        results.push({
          orgId,
          registros: report.billingRecords,
          eventos: report.eventRecords,
          anomalias: report.anomalies.length + report.eventAnomalies.length,
        })
      } catch (err) {
        // One organization failing must not stop the rest being checked.
        console.error('[cron/verifactu-integrity]', orgId, err)
        results.push({ orgId, error: String(err) })
      }
    }

    const anomalies = results.reduce((a, r) => a + Number(r.anomalias ?? 0), 0)
    if (anomalies > 0) console.error(`[cron/verifactu-integrity] ${anomalies} anomalías detectadas`)

    return NextResponse.json({ success: true, organizations: orgIds.length, anomalies, results })
  } catch (err) {
    console.error('[cron/verifactu-integrity] error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
