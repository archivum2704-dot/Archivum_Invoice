"use client"

import Link from "next/link"
import { Lock, ArrowLeft } from "lucide-react"
import { useTranslations } from "next-intl"
import type { DenyReason } from "@/lib/permissions"

/**
 * Shown in place of a section the member may not open.
 *
 * Deliberately a message rather than a redirect: a member who lands here should
 * understand that the section exists and that access is a permissions matter,
 * not that the app is broken or the link is dead.
 */
export function AccessDenied({ reason = "role" }: { reason?: DenyReason }) {
  const t = useTranslations("access")

  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
        <Lock className="w-6 h-6 text-muted-foreground/70" />
      </div>

      <h1 className="text-lg font-semibold text-foreground">{t("deniedTitle")}</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
        {reason === "noCompanies" ? t("deniedNoCompanies") : t("deniedRole")}
      </p>

      <Link
        href="/dashboard"
        className="mt-7 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t("backToDashboard")}
      </Link>
    </div>
  )
}
