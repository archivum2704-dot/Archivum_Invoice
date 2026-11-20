import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cronRequestIsAuthorised } from "@/lib/cron-auth"

/**
 * GET /api/cron/mark-overdue
 *
 * Called daily by Vercel Cron (vercel.json → crons).
 * Marks all pending documents whose due_date has passed as "overdue".
 *
 * Protected by CRON_SECRET env var — Vercel automatically sends
 * Authorization: Bearer <CRON_SECRET> from its infrastructure.
 */
export async function GET(request: Request) {
  if (!cronRequestIsAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = await createClient(true) // admin = service role, bypasses RLS
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from("documents")
      .update({ status: "overdue", updated_at: new Date().toISOString() })
      .eq("status", "pending")
      .lt("due_date", today)
      .select("id")

    if (error) throw error

    const count = data?.length ?? 0
    console.log(`[mark-overdue] Marked ${count} documents as overdue (${today})`)

    // Free trials (the 30 days of Pro given at sign-up) that ended without a
    // Stripe subscription go back to the free plan. Status 'active' with plan
    // 'free' is how a free organization looks; 'canceled' would make
    // (protected)/layout.tsx schedule its data for deletion. Runs here because
    // Hobby allows only two cron jobs. trial_ends_at stays, so no second trial.
    const { data: expired, error: trialErr } = await supabase
      .from("organizations")
      .update({ subscription_plan: "free", subscription_status: "active" })
      .eq("subscription_status", "trialing")
      .neq("subscription_plan", "free")
      .is("stripe_subscription_id", null)
      .lt("trial_ends_at", new Date().toISOString())
      .select("id")
    if (trialErr) console.error("[mark-overdue] trial expiry:", trialErr)
    const trialsEnded = expired?.length ?? 0
    if (trialsEnded) console.log(`[mark-overdue] ${trialsEnded} free trials ended → free plan`)

    return NextResponse.json({
      ok: true,
      date: today,
      markedOverdue: count,
      trialsEnded,
    })
  } catch (err: any) {
    console.error("[mark-overdue] Error:", err)
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 })
  }
}
