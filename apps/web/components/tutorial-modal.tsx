"use client"

import { useState, useEffect, useRef } from "react"
import {
  Sparkles, Upload, Building2, Users, Search, Library,
  Package, Receipt, ArrowRight, ArrowLeft, X, Lightbulb,
  LayoutDashboard, ClipboardList, Truck, Settings as SettingsIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"

// Bump the version when the tutorial content changes so returning users see it again.
const TUTORIAL_KEY = "archivum_tutorial_completed_v3"

export type SlideKey =
  | "welcome" | "dashboard" | "companies" | "quotes" | "deliveryNotes"
  | "upload" | "library" | "inventory" | "invoicing" | "search" | "team" | "settings"

interface SlideStyle {
  key: SlideKey
  icon: typeof Sparkles
  iconBg: string
  iconText: string
  stepBg: string
  stepText: string
  buttonBg: string
  dotActive: string
}

// Order here is also the order of the full onboarding walkthrough.
const SLIDE_STYLES: SlideStyle[] = [
  {
    key: "welcome", icon: Sparkles,
    iconBg: "bg-blue-50 dark:bg-blue-950/30",     iconText: "text-blue-600 dark:text-blue-400",
    stepBg: "bg-blue-100 dark:bg-blue-950/40",    stepText: "text-blue-700 dark:text-blue-300",
    buttonBg: "bg-blue-600 hover:bg-blue-700", dotActive: "bg-blue-600",
  },
  {
    key: "dashboard", icon: LayoutDashboard,
    iconBg: "bg-indigo-50 dark:bg-indigo-950/30", iconText: "text-indigo-600 dark:text-indigo-400",
    stepBg: "bg-indigo-100 dark:bg-indigo-950/40", stepText: "text-indigo-700 dark:text-indigo-300",
    buttonBg: "bg-indigo-600 hover:bg-indigo-700", dotActive: "bg-indigo-600",
  },
  {
    key: "companies", icon: Building2,
    iconBg: "bg-purple-50 dark:bg-purple-950/30", iconText: "text-purple-600 dark:text-purple-400",
    stepBg: "bg-purple-100 dark:bg-purple-950/40", stepText: "text-purple-700 dark:text-purple-300",
    buttonBg: "bg-purple-600 hover:bg-purple-700", dotActive: "bg-purple-600",
  },
  {
    key: "quotes", icon: ClipboardList,
    iconBg: "bg-teal-50 dark:bg-teal-950/30",     iconText: "text-teal-600 dark:text-teal-400",
    stepBg: "bg-teal-100 dark:bg-teal-950/40",    stepText: "text-teal-700 dark:text-teal-300",
    buttonBg: "bg-teal-600 hover:bg-teal-700", dotActive: "bg-teal-600",
  },
  {
    key: "deliveryNotes", icon: Truck,
    iconBg: "bg-lime-50 dark:bg-lime-950/30",     iconText: "text-lime-600 dark:text-lime-400",
    stepBg: "bg-lime-100 dark:bg-lime-950/40",    stepText: "text-lime-700 dark:text-lime-300",
    buttonBg: "bg-lime-600 hover:bg-lime-700", dotActive: "bg-lime-600",
  },
  {
    key: "upload", icon: Upload,
    iconBg: "bg-green-50 dark:bg-green-950/30",   iconText: "text-green-600 dark:text-green-400",
    stepBg: "bg-green-100 dark:bg-green-950/40",  stepText: "text-green-700 dark:text-green-300",
    buttonBg: "bg-green-600 hover:bg-green-700", dotActive: "bg-green-600",
  },
  {
    key: "library", icon: Library,
    iconBg: "bg-sky-50 dark:bg-sky-950/30",       iconText: "text-sky-600 dark:text-sky-400",
    stepBg: "bg-sky-100 dark:bg-sky-950/40",      stepText: "text-sky-700 dark:text-sky-300",
    buttonBg: "bg-sky-600 hover:bg-sky-700", dotActive: "bg-sky-600",
  },
  {
    key: "inventory", icon: Package,
    iconBg: "bg-violet-50 dark:bg-violet-950/30", iconText: "text-violet-600 dark:text-violet-400",
    stepBg: "bg-violet-100 dark:bg-violet-950/40", stepText: "text-violet-700 dark:text-violet-300",
    buttonBg: "bg-violet-600 hover:bg-violet-700", dotActive: "bg-violet-600",
  },
  {
    key: "invoicing", icon: Receipt,
    iconBg: "bg-emerald-50 dark:bg-emerald-950/30", iconText: "text-emerald-600 dark:text-emerald-400",
    stepBg: "bg-emerald-100 dark:bg-emerald-950/40", stepText: "text-emerald-700 dark:text-emerald-300",
    buttonBg: "bg-emerald-600 hover:bg-emerald-700", dotActive: "bg-emerald-600",
  },
  {
    key: "search", icon: Search,
    iconBg: "bg-amber-50 dark:bg-amber-950/30",   iconText: "text-amber-600 dark:text-amber-400",
    stepBg: "bg-amber-100 dark:bg-amber-950/40",  stepText: "text-amber-700 dark:text-amber-300",
    buttonBg: "bg-amber-600 hover:bg-amber-700", dotActive: "bg-amber-600",
  },
  {
    key: "team", icon: Users,
    iconBg: "bg-orange-50 dark:bg-orange-950/30", iconText: "text-orange-600 dark:text-orange-400",
    stepBg: "bg-orange-100 dark:bg-orange-950/40", stepText: "text-orange-700 dark:text-orange-300",
    buttonBg: "bg-orange-600 hover:bg-orange-700", dotActive: "bg-orange-600",
  },
  {
    key: "settings", icon: SettingsIcon,
    iconBg: "bg-slate-50 dark:bg-slate-950/30",   iconText: "text-slate-600 dark:text-slate-400",
    stepBg: "bg-slate-100 dark:bg-slate-950/40",  stepText: "text-slate-700 dark:text-slate-300",
    buttonBg: "bg-slate-600 hover:bg-slate-700", dotActive: "bg-slate-600",
  },
]

export function isTutorialCompleted(): boolean {
  if (typeof window === "undefined") return true
  try { return localStorage.getItem(TUTORIAL_KEY) === "true" }
  catch { return true }
}

export function resetTutorial(): void {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(TUTORIAL_KEY) } catch {}
}

interface TutorialModalProps {
  open: boolean
  onClose: () => void
  /** Slide to open on, e.g. jumping straight to "inventory" from the Inventario page. Defaults to "welcome". */
  initialSlide?: SlideKey
  /**
   * Restrict the walkthrough to just these slides, in this order — this is
   * what makes a section's own help button a *personal* tutorial for that
   * section instead of a random entry point into the full 12-slide
   * onboarding tour (paging "next" used to drift into whatever topic came
   * next in the global order, which had nothing to do with the section the
   * user actually asked about). Omit for the complete tour — used by
   * TutorialAutoLauncher and the "Ver tutorial de bienvenida" button.
   */
  slideKeys?: SlideKey[]
}

export function TutorialModal({ open, onClose, initialSlide = "welcome", slideKeys }: TutorialModalProps) {
  const t = useTranslations("tutorial")
  const [page, setPage] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  const slides = slideKeys
    ? slideKeys.map(k => SLIDE_STYLES.find(s => s.key === k)).filter((s): s is SlideStyle => !!s)
    : SLIDE_STYLES
  const total = slides.length
  const isLast = page === total - 1
  const isFirst = page === 0
  const slide = slides[page] ?? slides[0]
  const Icon = slide.icon
  const isWelcome = slide.key === "welcome"

  // Step-by-step content pulled as raw arrays/strings from the message catalog
  const steps = (t.raw(`slides.${slide.key}.steps`) as string[] | undefined) ?? []
  const rawSlide = t.raw(`slides.${slide.key}`) as { tip?: string }
  const tip = rawSlide?.tip

  // Reset to the requested slide each time it opens
  useEffect(() => {
    if (open) {
      const idx = slides.findIndex((s) => s.key === initialSlide)
      setPage(idx >= 0 ? idx : 0)
    }
  }, [open, initialSlide])

  // ESC to close, arrow keys for nav
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleComplete()
      else if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, total - 1))
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 0))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, total])

  const singleSlide = total <= 1

  const handleComplete = () => {
    // Only the full onboarding sequence marks itself "seen" — a section's own
    // help button should show its content every time it's clicked, not just once.
    if (!slideKeys) {
      try { localStorage.setItem(TUTORIAL_KEY, "true") } catch {}
    }
    onClose()
  }

  const handleNext = () => {
    if (isLast) handleComplete()
    else setPage((p) => p + 1)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleComplete}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
      >
        {/* Skip / close */}
        <button
          onClick={handleComplete}
          aria-label={t("skip")}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Slide content */}
        <div className="p-8 pt-10 flex flex-col items-center text-center overflow-y-auto">
          {/* Icon (welcome slide shows the Archivum logo instead) */}
          <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shrink-0", slide.iconBg)}>
            {isWelcome ? (
              <Logo size={44} showText={false} />
            ) : (
              <Icon className={cn("w-10 h-10", slide.iconText)} />
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground mb-2.5 tracking-tight">
            {t(`slides.${slide.key}.title`)}
          </h2>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed max-w-sm">
            {t(`slides.${slide.key}.description`)}
          </p>

          {/* Step-by-step list */}
          <p className="w-full text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-2">
            {t("stepsLabel")}
          </p>
          <ol className="w-full space-y-2 mb-2">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3"
              >
                <span className={cn("w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold", slide.stepBg, slide.stepText)}>
                  {i + 1}
                </span>
                <span className="text-sm text-foreground text-left leading-snug">{step}</span>
              </li>
            ))}
          </ol>

          {/* Optional tip */}
          {tip && (
            <div className="w-full flex items-start gap-2.5 rounded-xl px-4 py-3 mt-1 bg-primary/5 border border-primary/15 text-left">
              <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-xs text-foreground/80 leading-snug">{tip}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-5 flex flex-col gap-4 shrink-0 bg-card">
          {/* Dots — pointless with only one slide */}
          {!singleSlide && (
            <div className="flex items-center justify-center gap-1.5">
              {slides.map((_, i) => {
                const active = i === page
                return (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      active ? cn("w-6", slide.dotActive) : "w-1.5 bg-border hover:bg-muted-foreground/40"
                    )}
                    aria-label={`Ir a slide ${i + 1}`}
                  />
                )
              })}
            </div>
          )}

          {/* Buttons — a lone topic opened from a section's help button just
              needs one way out, not Back/Skip/Next for a single slide. */}
          {singleSlide ? (
            <button
              onClick={handleComplete}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all hover:shadow-md",
                slide.buttonBg
              )}
            >
              {t("gotIt")}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={isFirst}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isFirst
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                {t("back")}
              </button>

              <button
                onClick={handleComplete}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
              >
                {t("skip")}
              </button>

              <button
                onClick={handleNext}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all hover:shadow-md",
                  slide.buttonBg
                )}
              >
                {isLast ? (slideKeys ? t("gotIt") : t("start")) : t("next")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Auto-show tutorial on first dashboard mount.
 * Place this once, e.g. in the AppShell, to handle automatic display.
 */
export function TutorialAutoLauncher() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isTutorialCompleted()) {
      // Small delay so the dashboard renders first
      const t = setTimeout(() => setOpen(true), 400)
      return () => clearTimeout(t)
    }
  }, [])

  return <TutorialModal open={open} onClose={() => setOpen(false)} />
}
