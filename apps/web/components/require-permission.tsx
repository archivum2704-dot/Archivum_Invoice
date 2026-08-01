"use client"

import { AccessDenied } from "@/components/access-denied"
import { useAccessContext } from "@/lib/hooks/use-access"
import { denyReason, type SectionId } from "@/lib/permissions"

/**
 * Renders a section only for members allowed to open it, and the reason why
 * not for everyone else. Wrap a page's view with it — the matching sidebar
 * entry renders locked from the same table, so the two always agree.
 */
export function RequirePermission({ section, children }: { section: SectionId; children: React.ReactNode }) {
  const { ctx, loading } = useAccessContext()

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
      </div>
    )
  }

  const reason = denyReason(section, ctx)
  if (reason) return <AccessDenied reason={reason} />

  return <>{children}</>
}
