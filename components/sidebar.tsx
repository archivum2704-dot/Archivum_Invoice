"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Library,
  Search,
  Upload,
  Settings,
  ChevronRight,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Panel Principal", icon: LayoutDashboard, href: "/" },
  { label: "Empresas", icon: Building2, href: "/empresas" },
  { label: "Biblioteca", icon: Library, href: "/biblioteca" },
  { label: "Buscador", icon: Search, href: "/buscador" },
  { label: "Subir Documento", icon: Upload, href: "/subir" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-primary">
          <BookOpen className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <span className="text-sidebar-foreground font-semibold text-base tracking-tight">DocVault</span>
          <p className="text-xs text-sidebar-foreground/50 leading-none mt-0.5">Archivo Digital</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-widest px-2 mb-3">Navegación</p>
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <Link
          href="/configuracion"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Configuración</span>
        </Link>
        <div className="flex items-center gap-3 px-3 py-3 mt-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold shrink-0">
            MA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-foreground text-xs font-medium truncate">María Administrador</p>
            <p className="text-sidebar-foreground/40 text-xs truncate">admin@empresa.es</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
