import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

    return NextResponse.json({
      ok: true,
      date: today,
      markedOverdue: count,
    })
  } catch (err: any) {
    console.error("[mark-overdue] Error:", err)
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 })
  }
}
