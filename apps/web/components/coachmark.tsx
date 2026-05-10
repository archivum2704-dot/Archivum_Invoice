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
  ctaLabel = "Entendido",
  force = false,
  onDismiss,
}: CoachmarkProps) {
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
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Consejo</p>
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">{description}</p>
          <button
            onClick={handleDismiss}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            {ctaLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
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
