"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"

const LINKS = [
  { href: "#funciones", label: "Funciones" },
  { href: "#verifactu", label: "VeriFactu" },
  { href: "#gestoria", label: "Tu gestoría" },
  { href: "#planes", label: "Planes" },
  { href: "#preguntas", label: "Preguntas" },
]

export function LandingNav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-lp-rule bg-lp-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-8">
        <a href="#inicio" aria-label="Archivum, inicio" onClick={() => setOpen(false)}>
          <Logo size={28} textClassName="lp-serif text-lp-ink text-[22px] tracking-[-0.02em]" />
        </a>

        <nav aria-label="Navegación principal" className="hidden items-center gap-8 lg:flex">
          {LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-lp-dim underline-offset-[6px] transition-colors duration-300 hover:text-lp-ink hover:underline"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <Link
            href="/auth/login"
            className="hidden text-sm text-lp-ink underline-offset-[6px] hover:underline sm:block"
          >
            Entrar
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-[5px] bg-lp-ink px-4 py-2.5 text-sm font-medium text-lp-paper transition-[background-color,transform] duration-300 ease-lp hover:bg-lp-accent active:translate-y-px"
          >
            Crear cuenta
          </Link>
          <button
            type="button"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="lp-mobile-menu"
            onClick={() => setOpen(o => !o)}
            className="relative -mr-2 h-10 w-10 text-lp-ink lg:hidden"
          >
            <span
              className={`absolute left-1/2 top-1/2 h-px w-5 -translate-x-1/2 bg-current transition-transform duration-500 ease-lp ${
                open ? "rotate-45" : "-translate-y-[4px]"
              }`}
            />
            <span
              className={`absolute left-1/2 top-1/2 h-px w-5 -translate-x-1/2 bg-current transition-transform duration-500 ease-lp ${
                open ? "-rotate-45" : "translate-y-[4px]"
              }`}
            />
          </button>
        </div>
      </div>

      <div
        id="lp-mobile-menu"
        className={`grid transition-[grid-template-rows] duration-500 ease-lp lg:hidden ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden" inert={!open}>
          <nav aria-label="Navegación móvil" className="px-5 pb-6 sm:px-8">
            {[...LINKS, { href: "/auth/login", label: "Entrar" }].map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{ transitionDelay: open ? `${60 + i * 40}ms` : "0ms" }}
                className={`lp-serif flex items-baseline gap-4 border-t border-lp-rule py-4 text-2xl text-lp-ink transition-[opacity,transform] duration-500 ease-lp ${
                  open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                }`}
              >
                <span className="lp-mono text-[11px] text-lp-dim">{String(i + 1).padStart(2, "0")}</span>
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
