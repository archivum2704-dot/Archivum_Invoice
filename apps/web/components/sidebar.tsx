"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Building2,
  Library,
  Search,
  Upload,
  Settings,
  CreditCard,
  ChevronRight,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Users,
  X,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { createClient } from "@/lib/supabase/client"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useOverdueDocs } from "@/lib/hooks/use-overdue-docs"

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const t = useTranslations("nav")
  const pathname = usePathname()
  const router = useRouter()
  const { currentOrg, userOrgs, userProfile, currentMember, isPlatformAdmin, isOrgAdmin, switchOrganization } =
    useOrganization()
  const [showOrgMenu, setShowOrgMenu] = useState(false)
  const { overdueCount } = useOverdueDocs(currentOrg?.id ?? null)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const handleSwitchOrg = async (orgId: string) => {
    await switchOrganization(orgId)
    setShowOrgMenu(false)
  }

  // Role-based nav: admins/owners see everything; members/viewers see limited set
  const memberRole = currentMember?.role
  const isOwnerOrAdmin = isOrgAdmin // owner | admin | platform_admin
  const isViewer = memberRole === "viewer"

  const navItems = [
    { label: t("dashboard"), icon: LayoutDashboard, href: "/dashboard" },
    // Empresas: only admins/owners manage companies
    ...(isOwnerOrAdmin
      ? [{ label: t("companies"), icon: Building2, href: "/empresas" }]
      : []),
    { label: t("library"), icon: Library, href: "/biblioteca" },
    { label: t("search"), icon: Search, href: "/buscador" },
    // Upload: members and admins can upload; viewers cannot
    ...(!isViewer
      ? [{ label: t("upload"), icon: Upload, href: "/subir" }]
      : []),
    // Usuarios: only admins/owners manage users
    ...(isOwnerOrAdmin
      ? [{ label: t("users"), icon: Users, href: "/usuarios" }]
      : []),
    ...(isPlatformAdmin
      ? [{ label: t("adminPanel"), icon: ShieldCheck, href: "/admin-dashboard" }]
      : []),
  ]

  const initials =
    (userProfile?.first_name?.charAt(0) ?? "") +
    (userProfile?.last_name?.charAt(0) ?? "")

  return (
    <aside className="flex flex-col w-64 h-full bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="flex items-start justify-between px-5 py-5 border-b border-sidebar-border">
        <div className="flex flex-col gap-1">
          <Logo size={40} textClassName="text-sidebar-foreground text-base" />
          <p className="text-xs text-sidebar-foreground/50 pl-[52px]">
            {isPlatformAdmin ? "Platform Admin" : currentOrg?.name ?? ""}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors lg:hidden mt-0.5"
          >
            <X className="w-4 h-4 text-sidebar-foreground/70" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href
          const showBadge = item.href === "/biblioteca" && overdueCount > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm group",
                "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                active
                  ? "bg-sidebar-primary/90 text-sidebar-primary-foreground font-semibold"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
              )}
            >
              {/* Active left-bar indicator */}
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  active ? "h-5 bg-sidebar-primary-foreground/70 opacity-100" : "h-0 opacity-0"
                )}
              />
              <item.icon className={cn("w-4 h-4 shrink-0 transition-transform duration-200", active && "scale-110")} />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--status-overdue)] text-white text-[10px] font-bold flex items-center justify-center">
                  {overdueCount > 99 ? "99+" : overdueCount}
                </span>
              )}
              {active && !showBadge && (
                <ChevronRight className="w-3 h-3 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Organization switcher — platform admin + multi-org users only */}
      {(isPlatformAdmin || userOrgs.length > 1) && (
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="relative">
            <button
              onClick={() => setShowOrgMenu(!showOrgMenu)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sidebar-foreground text-xs font-medium truncate">
                  {currentOrg?.name ?? "Select organization"}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-sidebar-foreground/50 transition-transform",
                  showOrgMenu && "rotate-180"
                )}
              />
            </button>

            {showOrgMenu && userOrgs.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-sidebar border border-sidebar-border rounded-lg shadow-lg z-50 overflow-hidden">
                {userOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSwitchOrg(org.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs transition-colors",
                      currentOrg?.id === org.id
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                    )}
                  >
                    {org.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
        <Link
          href="/configuracion"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          <Settings className="w-4 h-4" />
          <span>{t("settings")}</span>
        </Link>
        {isOrgAdmin && (
          <Link
            href="/configuracion/billing"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
              pathname === "/configuracion/billing"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
            )}
          >
            <CreditCard className="w-4 h-4" />
            <span>Facturación</span>
          </Link>
        )}

        {/* User row */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/80 ring-2 ring-sidebar-primary/30 flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold shrink-0">
            {initials || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-foreground text-xs font-semibold truncate">
              {userProfile?.first_name} {userProfile?.last_name}
            </p>
            <p className="text-sidebar-foreground/35 text-[10px] truncate">{userProfile?.email}</p>
          </div>
          <LanguageSwitcher />
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("signOut")}</span>
        </button>
      </div>
    </aside>
  )
}
