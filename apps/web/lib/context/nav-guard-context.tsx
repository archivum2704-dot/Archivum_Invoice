"use client"

import {
  createContext, useContext, useRef, useState, useEffect, useCallback, type ReactNode,
} from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Loader2, AlertTriangle, X } from "lucide-react"

export type NavGuardKind = "document" | "invoice"

export type NavGuard = {
  /** Is there unsaved work right now? */
  isDirty: () => boolean
  kind: NavGuardKind
  /** Persist the in-progress work as a draft. Throws on failure. */
  onSaveDraft: () => Promise<void>
}

type Ctx = {
  /** Register (or clear with null) the active guard for the current page. */
  register: (g: NavGuard | null) => void
}

const NavGuardContext = createContext<Ctx | null>(null)

/**
 * Register a navigation guard for the current form. `dirty` and `onSaveDraft`
 * can change every render — they're read through a ref so the provider always
 * sees the latest values without re-registering.
 */
export function useRegisterNavGuard(dirty: boolean, kind: NavGuardKind, onSaveDraft: () => Promise<void>) {
  const ctx = useContext(NavGuardContext)
  const latest = useRef({ dirty, onSaveDraft })
  latest.current = { dirty, onSaveDraft }

  useEffect(() => {
    if (!ctx) return
    ctx.register({
      kind,
      isDirty: () => latest.current.dirty,
      onSaveDraft: () => latest.current.onSaveDraft(),
    })
    return () => ctx.register(null)
    // Register once per mount; values are read live via the ref above.
  }, [ctx, kind])
}

export function NavGuardProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("navGuard")
  const router = useRouter()
  const pathname = usePathname()

  const guardRef = useRef<NavGuard | null>(null)
  const [pending, setPending] = useState<{ href: string; kind: NavGuardKind } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback((g: NavGuard | null) => { guardRef.current = g }, [])

  // Intercept in-app link navigation while a form is dirty (capture phase, so it
  // runs before Next's own click handler and can cancel the client navigation).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const g = guardRef.current
      if (!g || !g.isDirty()) return
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || !href.startsWith("/")) return                 // internal routes only
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return
      if (anchor.hasAttribute("data-allow-unsaved")) return      // explicit cancel/back opt-out
      if (href.split("?")[0] === pathname) return                // same page → allow
      e.preventDefault()
      e.stopPropagation()
      setError(null)
      setPending({ href, kind: g.kind })
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [pathname])

  // Native prompt for reload / tab close / browser back while dirty.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const g = guardRef.current
      if (g && g.isDirty()) { e.preventDefault(); e.returnValue = "" }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  const closeModal = () => { if (!saving) setPending(null) }

  const handleSaveDraft = async () => {
    const g = guardRef.current
    const href = pending?.href
    if (!g) { setPending(null); if (href) router.push(href); return }
    setSaving(true); setError(null)
    try {
      await g.onSaveDraft()
      guardRef.current = null            // avoid re-triggering during the pending nav
      setPending(null); setSaving(false)
      if (href) router.push(href)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("savingError"))
      setSaving(false)
    }
  }

  return (
    <NavGuardContext.Provider value={{ register }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
              </div>
              <button onClick={closeModal} disabled={saving}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {pending.kind === "invoice" ? t("bodyInvoice") : t("bodyDocument")}
              </p>
              <div className="bg-muted/50 border border-border rounded-lg px-4 py-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pending.kind === "invoice" ? t("hintInvoice") : t("hintDocument")}
                </p>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="flex items-center gap-3 p-4 border-t border-border">
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("saving")}</> : t("saveDraft")}
              </button>
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {t("keepEditing")}
              </button>
            </div>
          </div>
        </div>
      )}
    </NavGuardContext.Provider>
  )
}
