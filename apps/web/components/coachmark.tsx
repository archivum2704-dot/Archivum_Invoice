"use client"

/**
 * Coachmark — interactive first-time hint that points at a UI element.
 *
 * Usage:
 *   <Coachmark
 *     id="upload-first-doc"
 *     targetRef={uploadButtonRef}
 *     title="Sube tu primer documento"
 *     description="Arrastra una factura aquí o haz click para seleccionarla."
 *     placement="bottom"
 *   />
 *
 * The hint shows once per id (persisted in localStorage). Use `resetCoachmark(id)`
 * or `resetAllCoachmarks()` to replay them (e.g. from a help menu).
 */

import { useEffect, useState, useRef, useLayoutEffect, RefObject } from "react"
import { X, ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const COACHMARK_PREFIX = "archivum_coachmark_"

export function isCoachmarkSeen(id: string): boolean {
  if (typeof window === "undefined") return true
  try { return localStorage.getItem(COACHMARK_PREFIX + id) === "true" }
  catch { return true }
}

export function markCoachmarkSeen(id: string): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(COACHMARK_PREFIX + id, "true") } catch {}
}

export function resetCoachmark(id: string): void {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(COACHMARK_PREFIX + id) } catch {}
}

export function resetAllCoachmarks(): void {
  if (typeof window === "undefined") return
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(COACHMARK_PREFIX)) localStorage.removeItem(key)
    }
  } catch {}
}

type Placement = "top" | "bottom" | "left" | "right"

interface CoachmarkProps {
  id: string
  targetRef: RefObject<HTMLElement | null>
  title: string
  description: string
  placement?: Placement
  ctaLabel?: string
  /** Show even if already seen (for manual replay). Default false. */
  force?: boolean
  /** Called after the user dismisses the coachmark. */
  onDismiss?: () => void
}

const ARROW_SIZE = 8
const TOOLTIP_GAP = 14
const TOOLTIP_WIDTH = 320

export function Coachmark({
  id,
  targetRef,
  title,
  description,
  placement = "bottom",
  ctaLabel,
  force = false,
  onDismiss,
}: CoachmarkProps) {
  const t = useTranslations("coachmarks")
  const cta = ctaLabel ?? t("gotIt")
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  // Decide initial visibility
  useEffect(() => {
    if (force || !isCoachmarkSeen(id)) {
      // Small delay so the target has time to mount
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [id, force])

  // Track target position
  useLayoutEffect(() => {
    if (!visible) return
    const update = () => {
      const el = targetRef.current
      if (!el) { setRect(null); return }
      setRect(el.getBoundingClientRect())
    }
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    const interval = setInterval(update, 200) // catch layout shifts
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
      clearInterval(interval)
    }
  }, [visible, targetRef])

  const handleDismiss = () => {
    markCoachmarkSeen(id)
    setVisible(false)
    onDismiss?.()
  }

  if (!visible || !rect) return null

  // Compute tooltip position based on placement (and clamp to viewport)
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024
  const vh = typeof window !== "undefined" ? window.innerHeight : 768
  const tipW = TOOLTIP_WIDTH
  let tipTop = 0, tipLeft = 0
  let arrowSide: Placement = placement

  // Auto-flip if not enough room
  if (placement === "bottom" && rect.bottom + tipW > vh) arrowSide = "top"
  if (placement === "top"    && rect.top    - tipW < 0)  arrowSide = "bottom"

  switch (arrowSide) {
    case "bottom":
      tipTop = rect.bottom + TOOLTIP_GAP
      tipLeft = rect.left + rect.width / 2 - tipW / 2
      break
    case "top":
      tipTop = rect.top - TOOLTIP_GAP - 200 // approx tooltip height; we'll adjust via translate below
      tipLeft = rect.left + rect.width / 2 - tipW / 2
      break
    case "right":
      tipTop = rect.top + rect.height / 2 - 80
      tipLeft = rect.right + TOOLTIP_GAP
      break
    case "left":
      tipTop = rect.top + rect.height / 2 - 80
      tipLeft = rect.left - TOOLTIP_GAP - tipW
      break
  }

  // Clamp horizontally
  const margin = 12
  tipLeft = Math.max(margin, Math.min(tipLeft, vw - tipW - margin))

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-none"
      role="dialog"
      aria-label={title}
    >
      {/* SVG mask: dark overlay with hole around the target */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ pointerEvents: "auto" }}>
        <defs>
          <mask id={`coachmark-mask-${id}`}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - 6}
              y={rect.top - 6}
              width={rect.width + 12}
              height={rect.height + 12}
              rx="10"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.55)"
          mask={`url(#coachmark-mask-${id})`}
          onClick={handleDismiss}
          style={{ cursor: "pointer" }}
        />
      </svg>

      {/* Pulsing ring around the target */}
      <div
        className="absolute border-2 border-primary rounded-xl animate-pulse pointer-events-none"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0)",
        }}
      />

      {/* Tooltip */}
      <div
        ref={tipRef}
        className={cn(
          "absolute bg-card border border-border rounded-2xl shadow-2xl p-5 pointer-events-auto",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
        style={{
          top: tipTop,
          left: tipLeft,
          width: tipW,
          transform: arrowSide === "top" ? "translateY(-100%)" : undefined,
        }}
      >
        {/* Arrow */}
        <ArrowMark side={arrowSide} targetRect={rect} tipLeft={tipLeft} tipTop={tipTop} />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="pr-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{t("tipLabel")}</p>
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">{description}</p>
          <button
            onClick={handleDismiss}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            {cta}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Multi-step tour ──────────────────────────────────────────────────────────

export interface TourStep {
  /** Used only for keying/debugging — the entire tour shares one persistence id */
  key: string
  targetRef: RefObject<HTMLElement | null>
  title: string
  description: string
  placement?: Placement
}

interface CoachmarkTourProps {
  /** Single id used to persist the tour completion */
  id: string
  steps: TourStep[]
  /** Whether the tour should be active right now (e.g. only when conditions met) */
  active?: boolean
  /** Force show even if already completed (manual replay) */
  force?: boolean
  /** Called when tour is dismissed or finished */
  onComplete?: () => void
}

export function CoachmarkTour({ id, steps, active = true, force = false, onComplete }: CoachmarkTourProps) {
  const t = useTranslations("coachmarks")
  const tT = useTranslations("tutorial")
  const [stepIndex, setStepIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const total = steps.length
  const current = steps[stepIndex]
  const isLast = stepIndex === total - 1
  const isFirst = stepIndex === 0

  useEffect(() => {
    if (!active) return
    if (force || !isCoachmarkSeen(id)) {
      const t = setTimeout(() => setRunning(true), 600)
      return () => clearTimeout(t)
    }
  }, [id, active, force])

  // Track current step's target rect — re-runs when the step changes
  useLayoutEffect(() => {
    if (!running || !current) return
    const update = () => {
      const el = current.targetRef.current
      if (!el) { setRect(null); return }
      const r = el.getBoundingClientRect()
      setRect(r)
      // Scroll target into view if off-screen
      if (r.top < 80 || r.bottom > window.innerHeight - 80) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    const interval = setInterval(update, 200)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
      clearInterval(interval)
    }
  }, [running, stepIndex, current])

  const finish = () => {
    markCoachmarkSeen(id)
    setRunning(false)
    onComplete?.()
  }

  const next = () => {
    if (isLast) finish()
    else setStepIndex(i => i + 1)
  }

  const prev = () => setStepIndex(i => Math.max(0, i - 1))

  if (!running || !current || !rect) return null

  // Compute tooltip position (similar to single-step Coachmark)
  const placement = current.placement ?? "bottom"
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024
  const vh = typeof window !== "undefined" ? window.innerHeight : 768
  const tipW = TOOLTIP_WIDTH
  let tipTop = 0, tipLeft = 0
  let arrowSide: Placement = placement

  if (placement === "bottom" && rect.bottom + 220 > vh) arrowSide = "top"
  if (placement === "top"    && rect.top    - 220 < 0)  arrowSide = "bottom"

  switch (arrowSide) {
    case "bottom":
      tipTop = rect.bottom + TOOLTIP_GAP
      tipLeft = rect.left + rect.width / 2 - tipW / 2
      break
    case "top":
      tipTop = rect.top - TOOLTIP_GAP - 220
      tipLeft = rect.left + rect.width / 2 - tipW / 2
      break
    case "right":
      tipTop = rect.top + rect.height / 2 - 90
      tipLeft = rect.right + TOOLTIP_GAP
      break
    case "left":
      tipTop = rect.top + rect.height / 2 - 90
      tipLeft = rect.left - TOOLTIP_GAP - tipW
      break
  }

  const margin = 12
  tipLeft = Math.max(margin, Math.min(tipLeft, vw - tipW - margin))
  tipTop  = Math.max(margin, Math.min(tipTop,  vh - 220 - margin))

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none" role="dialog" aria-label={current.title}>
      {/* Spotlight overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id={`tour-mask-${id}-${stepIndex}`}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - 6} y={rect.top - 6}
              width={rect.width + 12} height={rect.height + 12}
              rx="10" fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.55)"
          mask={`url(#tour-mask-${id}-${stepIndex})`}
          onClick={finish}
          style={{ cursor: "pointer" }}
        />
      </svg>

      {/* Pulsing ring */}
      <div
        className="absolute border-2 border-primary rounded-xl animate-pulse pointer-events-none"
        style={{
          top: rect.top - 6, left: rect.left - 6,
          width: rect.width + 12, height: rect.height + 12,
        }}
      />

      {/* Tooltip */}
      <div
        className="absolute bg-card border border-border rounded-2xl shadow-2xl p-5 pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
        style={{ top: tipTop, left: tipLeft, width: tipW }}
      >
        {/* Skip button */}
        <button
          onClick={finish}
          aria-label={tT("skip")}
          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        <div className="pr-4">
          {/* Step counter */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
              {t("tipLabel")} · {stepIndex + 1}/{total}
            </p>
          </div>

          <h3 className="text-sm font-semibold text-foreground mb-1.5">{current.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">{current.description}</p>

          {/* Progress bar */}
          <div className="flex gap-1 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i < stepIndex ? "flex-1 bg-primary/60"
                  : i === stepIndex ? "flex-[2] bg-primary"
                  : "flex-1 bg-border"
                )}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={prev}
              disabled={isFirst}
              className={cn(
                "text-xs font-medium px-2 py-1.5 rounded transition-colors",
                isFirst
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tT("back")}
            </button>

            <button
              onClick={finish}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
            >
              {tT("skip")}
            </button>

            <button
              onClick={next}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors"
            >
              {isLast ? tT("start") : tT("next")}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ArrowMark({ side, targetRect, tipLeft, tipTop }: {
  side: Placement; targetRect: DOMRect; tipLeft: number; tipTop: number
}) {
  // Pointing arrow - small triangle on the side of the tooltip facing the target
  const targetCenterX = targetRect.left + targetRect.width / 2
  const targetCenterY = targetRect.top + targetRect.height / 2

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    width: 0, height: 0, borderStyle: "solid",
  }
  if (side === "bottom") {
    return (
      <div style={{
        ...baseStyle,
        top: -ARROW_SIZE,
        left: Math.max(16, targetCenterX - tipLeft - ARROW_SIZE),
        borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: "transparent transparent var(--card-border, hsl(var(--border))) transparent",
      }}>
        <div style={{
          position: "absolute", top: 1, left: -ARROW_SIZE,
          width: 0, height: 0, borderStyle: "solid",
          borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
          borderColor: "transparent transparent hsl(var(--card)) transparent",
        }} />
      </div>
    )
  }
  if (side === "top") {
    return (
      <div style={{
        ...baseStyle,
        bottom: -ARROW_SIZE,
        left: Math.max(16, targetCenterX - tipLeft - ARROW_SIZE),
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
        borderColor: "hsl(var(--border)) transparent transparent transparent",
      }}>
        <div style={{
          position: "absolute", bottom: 1, left: -ARROW_SIZE,
          width: 0, height: 0, borderStyle: "solid",
          borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
          borderColor: "hsl(var(--card)) transparent transparent transparent",
        }} />
      </div>
    )
  }
  if (side === "right") {
    return (
      <div style={{
        ...baseStyle,
        left: -ARROW_SIZE,
        top: targetCenterY - tipTop - ARROW_SIZE,
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
        borderColor: "transparent hsl(var(--border)) transparent transparent",
      }} />
    )
  }
  // left
  return (
    <div style={{
      ...baseStyle,
      right: -ARROW_SIZE,
      top: targetCenterY - tipTop - ARROW_SIZE,
      borderWidth: `${ARROW_SIZE}px 0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
      borderColor: "transparent transparent transparent hsl(var(--border))",
    }} />
  )
}
