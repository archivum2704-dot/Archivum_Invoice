"use client"

import { useState } from "react"
import { HelpCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { TutorialModal, type SlideKey } from "@/components/tutorial-modal"

interface TutorialHelpButtonProps {
  /** Which tutorial slide to open on — matches the section this button lives in. */
  slide: SlideKey
  className?: string
}

/** Small "?" button that opens the onboarding tutorial straight on this section's slide. */
export function TutorialHelpButton({ slide, className }: TutorialHelpButtonProps) {
  const t = useTranslations("tutorial")
  const [open, setOpen] = useState(false)

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
      <TutorialModal open={open} initialSlide={slide} onClose={() => setOpen(false)} />
    </>
  )
}
