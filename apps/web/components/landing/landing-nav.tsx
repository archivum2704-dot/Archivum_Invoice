"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Logo } from "@/components/logo"

const LINKS = [
  { href: "#beneficios", label: "Beneficios" },
  { href: "#verifactu", label: "VeriFactu" },
  { href: "#como-funciona", label: "Cómo funciona" },
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
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-5">
      <div className="mx-auto max-w-5xl rounded-[1.75rem] bg-white/80 shadow-[0_10px_40px_-12px_rgba(26,45,73,0.18)] ring-1 ring-lp-navy/[0.07] backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-4 pl-4 pr-2 sm:h-16 sm:pl-6 sm:pr-3">
          <a href="#inicio" aria-label="Archivum, inicio" onClick={() => setOpen(false)}>
            <Logo size={30} textClassName="text-lp-navy text-[17px] font-extrabold tracking-[-0.04em]" />
          </a>

          <nav aria-label="Navegación principal" className="hidden items-center gap-7 lg:flex">
            {LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                className="text-[13px] font-semibold text-lp-ink transition-colors duration-300 ease-lp hover:text-lp-blue"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <Link
              href="/auth/login"
              className="hidden rounded-full px-4 py-2 text-[13px] font-semibold text-lp-navy transition-colors duration-300 ease-lp hover:bg-lp-navy/5 sm:block"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/auth/signup"
              className="group flex items-center gap-2 rounded-full bg-lp-blue py-1.5 pl-4 pr-1.5 text-[13px] font-bold text-white transition-[background-color,transform] duration-500 ease-lp hover:bg-lp-deep active:scale-[0.98]"
            >
              Empezar gratis
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-lp group-hover:translate-x-0.5 group-hover:-translate-y-px">
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </Link>
            <button
              type="button"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={open}
              aria-controls="lp-mobile-menu"
              onClick={() => setOpen(o => !o)}
              className="relative ml-0.5 h-10 w-10 rounded-full text-lp-navy transition-colors duration-300 ease-lp hover:bg-lp-navy/5 lg:hidden"
            >
              <span
                className={`absolute left-1/2 top-1/2 h-[1.5px] w-[18px] -translate-x-1/2 rounded-full bg-current transition-transform duration-500 ease-lp ${
                  open ? "rotate-45" : "-translate-y-[4px]"
                }`}
              />
              <span
                className={`absolute left-1/2 top-1/2 h-[1.5px] w-[18px] -translate-x-1/2 rounded-full bg-current transition-transform duration-500 ease-lp ${
                  open ? "-rotate-45" : "translate-y-[4px]"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Menú móvil: se despliega dentro de la propia isla */}
        <div
          id="lp-mobile-menu"
          className={`grid transition-[grid-template-rows] duration-500 ease-lp lg:hidden ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden" inert={!open}>
            <nav aria-label="Navegación móvil" className="flex flex-col px-4 pb-4 pt-1">
              {LINKS.map((l, i) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  style={{ transitionDelay: open ? `${80 + i * 45}ms` : "0ms" }}
                  className={`border-t border-lp-line py-3.5 text-[15px] font-semibold text-lp-navy transition-[opacity,transform] duration-500 ease-lp ${
                    open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                  }`}
                >
                  {l.label}
                </a>
              ))}
              <Link
                href="/auth/login"
                className="mt-2 rounded-full border border-lp-line py-3 text-center text-sm font-semibold text-lp-navy sm:hidden"
              >
                Iniciar sesión
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}
