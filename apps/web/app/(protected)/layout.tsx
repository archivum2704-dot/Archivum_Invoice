import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { SubscriptionBanner } from '@/components/subscription-banner'

/** How many days between subscription expiry and data deletion */
const GRACE_DAYS = 15

/** Monthly document quota per plan (used when topping up via webhook) */
export const PLAN_MONTHLY_DOCS: Record<string, number> = {
  free:    20,
  starter: 200,
  pro:     500,
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // ── Single-device session check ────────────────────────────────────────────
  const cookieStore = await cookies()
  const sidCookie   = cookieStore.get('archivum_sid')?.value

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, active_session_id, current_org_id')
    .eq('id', user.id)
    .single()

  // If a session_id exists in DB but doesn't match the cookie → another device
  // logged in and invalidated this session. Sign out and redirect.
  if (
    profile?.active_session_id &&
    sidCookie &&
    profile.active_session_id !== sidCookie
  ) {
    await supabase.auth.signOut()
    redirect('/auth/login?reason=other_device')
  }

  // If cookie is missing but we're authenticated, register a new session
  // (handles refresh after SSR rehydration or first load after OAuth)
  if (!sidCookie && profile) {
    const sessionId = crypto.randomUUID()
    await supabase.from('profiles').update({ active_session_id: sessionId }).eq('id', user.id)
    // Note: Can't set a cookie directly from a Server Component (no Response object).
    // The client will call /api/auth/register-session on mount for this case.
    // For now the check will pass since DB has the new value.
  }

  // ── Onboarding gate ────────────────────────────────────────────────────────
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (!memberships?.length) redirect('/onboarding')

  // ── Subscription status check ──────────────────────────────────────────────
  const orgId = profile?.current_org_id
  let subscriptionBanner: React.ReactNode = null

  if (orgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select(
        'subscription_status, subscription_plan, current_period_end, doc_quota_pool, deletion_scheduled_at, expiry_notified_at'
      )
      .eq('id', orgId)
      .single()

    if (org) {
      const now         = new Date()
      const periodEnd   = org.current_period_end ? new Date(org.current_period_end) : null
      const isExpired   = ['canceled', 'unpaid'].includes(org.subscription_status ?? '') && periodEnd && now > periodEnd
      const isPastDue   = org.subscription_status === 'past_due'
      const isPaused    = org.subscription_status === 'paused'

      // Schedule deletion if not already set
      if (isExpired && !org.deletion_scheduled_at) {
        const deletionDate = new Date(periodEnd!.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000)
        await supabase
          .from('organizations')
          .update({
            deletion_scheduled_at: deletionDate.toISOString(),
            expiry_notified_at: now.toISOString(),
          })
          .eq('id', orgId)
      }

      // Compute days until deletion
      let daysUntilDeletion: number | null = null
      if (org.deletion_scheduled_at) {
        const diff = new Date(org.deletion_scheduled_at).getTime() - now.getTime()
        daysUntilDeletion = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      }

      // Show banner if subscription is not healthy
      if (isExpired || isPastDue || isPaused) {
        const bannerStatus =
          isPastDue  ? 'past_due' :
          isPaused   ? 'paused' :
          isExpired  ? 'expired' : 'canceled'

        subscriptionBanner = (
          <SubscriptionBanner
            status={bannerStatus as any}
            daysUntilDeletion={daysUntilDeletion}
            readOnly={!!isExpired}
          />
        )
      }
    }
  }

  return (
    <AppShell>
      {subscriptionBanner}
      {children}
    </AppShell>
  )
}
