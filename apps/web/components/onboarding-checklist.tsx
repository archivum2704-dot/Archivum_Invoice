"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CheckCircle2, Circle, ChevronRight, X, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useOnboarding } from "@/lib/hooks/use-onboarding"

const STORAGE_KEY = "archivum_onboarding_dismissed"

interface OnboardingChecklistProps {
  orgId: string | null
}

export function OnboardingChecklist({ orgId }: OnboardingChecklistProps) {
  const { steps, completedCount, totalCount, allDone, pct, loading } = useOnboarding(orgId)
  const [dismissed, setDismissed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "true")
    }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(STORAGE_KEY, "true")
  }

  // Auto-dismiss permanently once everything is done
  useEffect(() => {
    if (allDone && mounted) handleDismiss()
  }, [allDone, mounted])

  if (!mounted || dismissed || loading) return null

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Primeros pasos</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedCount} de {totalCount} completados
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-muted transition-colors shrink-0"
            title="Ocultar"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 px-5 py-3 transition-colors",
              step.done ? "opacity-60" : "hover:bg-muted/40"
            )}
          >
            {step.done
              ? <CheckCircle2 className="w-4 h-4 text-[var(--status-paid)] shrink-0" />
              : <Circle      className="w-4 h-4 text-muted-foreground shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-medium", step.done ? "line-through text-muted-foreground" : "text-foreground")}>
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              )}
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
              >
                {step.cta}
                <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
