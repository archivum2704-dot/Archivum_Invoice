"use client"

import { useState, useEffect, useRef } from "react"
import {
  Sparkles, Upload, Building2, Users, Search,
  ArrowRight, ArrowLeft, X,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const TUTORIAL_KEY = "archivum_tutorial_completed_v1"

interface SlideStyle {
  key: "welcome" | "upload" | "companies" | "team" | "search"
  icon: typeof Sparkles
  iconBg: string
  iconText: string
  bulletDot: string
  buttonBg: string
  dotActive: string
}

const SLIDE_STYLES: SlideStyle[] = [
  {
    key: "welcome", icon: Sparkles,
    iconBg: "bg-blue-50 dark:bg-blue-950/30",     iconText: "text-blue-600 dark:text-blue-400",
    bulletDot: "bg-blue-500", buttonBg: "bg-blue-600 hover:bg-blue-700", dotActive: "bg-blue-600",
  },
  {
    key: "upload", icon: Upload,
    iconBg: "bg-green-50 dark:bg-green-950/30",   iconText: "text-green-600 dark:text-green-400",
    bulletDot: "bg-green-500", buttonBg: "bg-green-600 hover:bg-green-700", dotActive: "bg-green-600",
  },
  {
    key: "companies", icon: Building2,
    iconBg: "bg-purple-50 dark:bg-purple-950/30", iconText: "text-purple-600 dark:text-purple-400",
    bulletDot: "bg-purple-500", buttonBg: "bg-purple-600 hover:bg-purple-700", dotActive: "bg-purple-600",
  },
  {
    key: "team", icon: Users,
    iconBg: "bg-orange-50 dark:bg-orange-950/30", iconText: "text-orange-600 dark:text-orange-400",
    bulletDot: "bg-orange-500", buttonBg: "bg-orange-600 hover:bg-orange-700", dotActive: "bg-orange-600",
  },
  {
    key: "search", icon: Search,
    iconBg: "bg-amber-50 dark:bg-amber-950/30",   iconText: "text-amber-600 dark:text-amber-400",
    bulletDot: "bg-amber-500", buttonBg: "bg-amber-600 hover:bg-amber-700", dotActive: "bg-amber-600",
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
}

export function TutorialModal({ open, onClose }: TutorialModalProps) {
  const t = useTranslations("tutorial")
  const [page, setPage] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  const total = SLIDE_STYLES.length
  const isLast = page === total - 1
  const isFirst = page === 0
  const slide = SLIDE_STYLES[page]
  const Icon = slide.icon

  // Reset to first slide each time it opens
  useEffect(() => {
    if (open) setPage(0)
  }, [open])

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

  const handleComplete = () => {
    try { localStorage.setItem(TUTORIAL_KEY, "true") } catch {}
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
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
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
        <div className="p-8 pt-12 flex flex-col items-center text-center">
          {/* Icon */}
          <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-6", slide.iconBg)}>
            <Icon className={cn("w-12 h-12", slide.iconText)} />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
            {t(`slides.${slide.key}.title`)}
          </h2>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-sm">
            {t(`slides.${slide.key}.description`)}
          </p>

          {/* Bullets */}
          <div className="w-full space-y-2 mb-2">
            {(["b1", "b2", "b3"] as const).map((b) => (
              <div
                key={b}
                className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3"
              >
                <div className={cn("w-2 h-2 rounded-full shrink-0", slide.bulletDot)} />
                <span className="text-sm text-foreground font-medium text-left">{t(`slides.${slide.key}.${b}`)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-5 flex flex-col gap-4">
          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5">
            {SLIDE_STYLES.map((_, i) => {
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

          {/* Buttons */}
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
              {isLast ? t("start") : t("next")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
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
