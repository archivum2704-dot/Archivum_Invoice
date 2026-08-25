"use client"

import { useState } from "react"
import { HelpCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { TutorialModal, type SlideKey } from "@/components/tutorial-modal"

interface TutorialHelpButtonProps {
  /**
   * Which tutorial slide(s) this section's help opens on. Pass a single key
   * for a one-topic section, or an ordered array for sections that are really
   * one flow split across the sidebar (e.g. Pedidos + Albaranes) — the
   * button always scopes the tutorial to just this list, so "next" never
   * drifts into an unrelated topic from the full onboarding tour.
   */
  slide: SlideKey | SlideKey[]
  className?: string
}

/** Small "?" button that opens the tutorial scoped to just this section's own topic. */
export function TutorialHelpButton({ slide, className }: TutorialHelpButtonProps) {
  const t = useTranslations("tutorial")
  const [open, setOpen] = useState(false)
  const slideKeys = Array.isArray(slide) ? slide : [slide]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("sectionHelp")}
        title={t("sectionHelp")}
        className={
          className ??
          "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        }
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      <TutorialModal open={open} initialSlide={slideKeys[0]} slideKeys={slideKeys} onClose={() => setOpen(false)} />
    </>
  )
}
