import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight, ArrowUpRight, Bell, BarChart3, Building2, Check, ChevronRight,
  Download, FileText, FolderOpen, Globe, HandCoins, Mail, Package, Plus,
  Receipt, Repeat, Search, Send, ShieldCheck, Truck, Users,
  type LucideIcon,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { LumenCredit } from "@/components/lumen-credit"
import { PLANS, ADDONS, PRICING_FAQ } from "@/lib/pricing"
import { LandingNav } from "./landing-nav"

/*
 * Landing pública. Parte del prototipo «Archivum_Landing_v02» y lo adapta a
 * lo que el producto hace hoy:
 *  - Planes y precios salen de lib/pricing.ts (fuente única), no del prototipo.
 *  - Sin reserva de llamadas (el prototipo traía un calendario de boceto).
 *  - VeriFactu: «Preparado para», nunca «conforme» ni «cumple» (ver CLAUDE.md).
 */

const ICON = { strokeWidth: 1.5 } as const

// ── Piezas reutilizables ─────────────────────────────────────────────────────

function delay(ms: number): CSSProperties {
  return { "--lp-delay": `${ms}ms` } as CSSProperties
}

function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] ${
        tone === "dark"
          ? "bg-white/10 text-lp-cyan ring-1 ring-white/15"
          : "bg-lp-blue/[0.07] text-lp-blue ring-1 ring-lp-blue/15"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-lp-cyan shadow-[0_0_0_3px_rgba(86,224,235,0.25)]" />
      {children}
    </span>
  )
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="lp-reveal mx-auto mb-12 max-w-3xl text-center sm:mb-16">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 text-balance text-[2rem] font-extrabold leading-[1.1] tracking-[-0.045em] text-lp-navy sm:text-[2.75rem]">
        {title}
      </h2>
      {children && <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-lp-ink sm:text-[17px]">{children}</p>}
    </div>
  )
}

/** Botón «isla»: píldora con la flecha en su propio círculo. */
function Cta({
  href, children, variant = "primary", external = false, className = "",
}: {
  href: string; children: ReactNode; variant?: "primary" | "ghost" | "white"; external?: boolean; className?: string
}) {
  const styles = {
    primary: "bg-lp-blue text-white shadow-[0_14px_30px_-10px_rgba(0,95,194,0.55)] hover:bg-lp-deep",
    ghost: "bg-white text-lp-navy ring-1 ring-lp-navy/10 hover:ring-lp-navy/25",
    white: "bg-white text-lp-deep hover:bg-lp-soft",
  }[variant]
  const bubble = {
    primary: "bg-white/15",
    ghost: "bg-lp-navy/[0.06]",
    white: "bg-lp-deep/[0.08]",
  }[variant]
  const cls = `group inline-flex items-center justify-between gap-3 rounded-full py-2 pl-6 pr-2 text-sm font-bold transition-[background-color,box-shadow,transform] duration-500 ease-lp active:scale-[0.98] ${styles} ${className}`
  const inner = (
    <>
      <span>{children}</span>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-500 ease-lp group-hover:translate-x-1 group-hover:-translate-y-px ${bubble}`}>
        {external ? <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} /> : <ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
      </span>
    </>
  )
  return href.startsWith("/") ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <a href={href} className={cls}>{inner}</a>
  )
}

/** Tarjeta de doble bisel: bandeja exterior + núcleo blanco concéntrico. */
function Bezel({ children, className = "", innerClassName = "" }: { children: ReactNode; className?: string; innerClassName?: string }) {
  return (
    <div className={`rounded-[1.75rem] bg-lp-navy/[0.035] p-1.5 ring-1 ring-lp-navy/[0.06] ${className}`}>
      <div
        className={`h-full rounded-[calc(1.75rem-0.375rem)] bg-white shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_18px_40px_-24px_rgba(26,45,73,0.25)] ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  )
}

function IconTile({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${className}`}>
      <Icon className="h-[22px] w-[22px]" {...ICON} />
    </span>
  )
}

// ── Ilustraciones del producto (maquetas, no capturas) ───────────────────────

function HeroMock() {
  const menu = ["Panel", "Facturas venta", "Facturas compra", "Pedidos", "Inventario", "Clientes"]
  const kpis = [
    { label: "Cobrado", value: "24.800 €", tone: "text-emerald-600" },
    { label: "Pendiente de cobro", value: "6.240 €", tone: "text-amber-600" },
    { label: "Vencido", value: "1.200 €", tone: "text-rose-600" },
  ]
  const rows = [
    { num: "FAC-2026-089", who: "Construcciones García", amount: "3.420,00 €", status: "Cobrada", cls: "bg-emerald-50 text-emerald-700" },
    { num: "ALB-2026-034", who: "Suministros López", amount: "840,00 €", status: "No facturado", cls: "bg-amber-50 text-amber-700" },
    { num: "PED-2026-021", who: "Reformas Martínez", amount: "12.000,00 €", status: "Aceptado", cls: "bg-lp-blue/10 text-lp-blue" },
    { num: "FAC-2026-088", who: "Taller Hermanos Ruiz", amount: "2.100,00 €", status: "Enviada", cls: "bg-lp-violet/10 text-lp-violet" },
  ]
  return (
    <div className="relative mx-auto w-full max-w-[600px] lg:max-w-none" aria-hidden="true">
      <div className="rounded-[2rem] bg-white/60 p-2 shadow-[0_50px_100px_-30px_rgba(21,51,92,0.35)] ring-1 ring-lp-navy/[0.08] lg:rotate-[1.2deg]">
        <div className="overflow-hidden rounded-[calc(2rem-0.5rem)] bg-white ring-1 ring-lp-navy/[0.05]">
          <div className="flex items-center gap-1.5 border-b border-lp-line px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-lp-line" />
            <span className="h-2 w-2 rounded-full bg-lp-line" />
            <span className="h-2 w-2 rounded-full bg-lp-line" />
            <span className="ml-auto text-[10px] font-semibold text-lp-ink/70">Vista ilustrativa del producto</span>
          </div>
          <div className="grid grid-cols-[92px_1fr] gap-3 p-3 sm:grid-cols-[140px_1fr] sm:gap-4 sm:p-4">
            <div className="rounded-2xl bg-lp-soft p-2 sm:p-3">
              <Logo size={18} className="mb-4 gap-1.5 px-1" textClassName="text-lp-navy text-[11px] font-extrabold" />
              {menu.map((m, i) => (
                <div
                  key={m}
                  className={`truncate rounded-lg px-2 py-1.5 text-[9px] sm:text-[10.5px] ${
                    i === 0 ? "bg-lp-blue/10 font-bold text-lp-blue" : "text-lp-ink"
                  }`}
                >
                  {m}
                </div>
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-[-0.03em] text-lp-navy sm:text-base">Tu negocio, de un vistazo</p>
              <p className="mb-3 mt-0.5 text-[9px] text-lp-ink sm:text-[10.5px]">Noviembre · 128 documentos archivados</p>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {kpis.map(k => (
                  <div key={k.label} className="rounded-xl border border-lp-line p-2 sm:p-2.5">
                    <p className="truncate text-[8px] text-lp-ink sm:text-[9px]">{k.label}</p>
                    <p className={`mt-1 text-[11px] font-extrabold tabular-nums sm:text-sm ${k.tone}`}>{k.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 rounded-xl border border-lp-line">
                <p className="px-3 py-2 text-[10px] font-bold text-lp-navy sm:text-[11px]">Documentos recientes</p>
                {rows.map(r => (
                  <div key={r.num} className="flex items-center gap-2 border-t border-lp-line/70 px-3 py-[7px]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[9px] font-semibold text-lp-navy sm:text-[10.5px]">{r.num}</p>
                      <p className="truncate text-[8px] text-lp-ink sm:text-[9px]">{r.who}</p>
                    </div>
                    <p className="hidden text-[10px] font-bold tabular-nums text-lp-navy sm:block">{r.amount}</p>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7.5px] font-bold sm:text-[8.5px] ${r.cls}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lp-float absolute -left-2 bottom-8 hidden sm:flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 shadow-[0_20px_44px_-14px_rgba(26,45,73,0.3)] ring-1 ring-lp-navy/[0.06] sm:-left-8">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <ShieldCheck className="h-4 w-4" {...ICON} />
        </span>
        <span>
          <span className="block text-[11px] font-bold text-lp-navy">Huella y QR generados</span>
          <span className="block text-[10px] text-lp-ink">Registro VeriFactu de la factura</span>
        </span>
      </div>
      <div
        className="lp-float absolute -bottom-7 right-10 hidden items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 shadow-[0_20px_44px_-14px_rgba(26,45,73,0.3)] ring-1 ring-lp-navy/[0.06] sm:flex"
        style={delay(1800)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lp-blue/10 text-lp-blue">
          <Repeat className="h-4 w-4" {...ICON} />
        </span>
        <span>
          <span className="block text-[11px] font-bold text-lp-navy">Albarán → Factura</span>
          <span className="block text-[10px] text-lp-ink">Sin volver a teclear nada</span>
        </span>
      </div>
    </div>
  )
}

/** QR decorativo (no es un código real): patrón fijo con los tres localizadores. */
function FakeQr({ className = "" }: { className?: string }) {
  const N = 21
  const cells: ReactNode[] = []
  const inFinder = (x: number, y: number) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (inFinder(x, y)) continue
      if ((x * 7 + y * 13 + ((x * y) % 5) + (x ^ y)) % 3 === 0) {
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
      }
    }
  }
  const finder = (x: number, y: number) => (
    <g key={`f-${x}-${y}`}>
      <rect x={x + 0.5} y={y + 0.5} width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  )
  return (
    <svg viewBox="0 0 21 21" className={className} fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      {cells}
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
    </svg>
  )
}

function InvoiceMock() {
  return (
    <div className="lp-reveal relative mx-auto w-full max-w-md lg:ml-auto lg:mr-0" aria-hidden="true">
      <div className="rounded-[2rem] bg-white/[0.07] p-2 ring-1 ring-white/15">
        <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 text-lp-navy shadow-[0_40px_80px_-30px_rgba(3,15,40,0.7)] sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-lp-ink">Factura</p>
              <p className="mt-1 text-xl font-extrabold tracking-[-0.03em]">FAC-2026-014</p>
              <p className="mt-0.5 text-[11px] text-lp-ink">9 de noviembre de 2026</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              <ShieldCheck className="h-3 w-3" strokeWidth={1.75} /> VERI*FACTU
            </span>
          </div>

          <div className="mt-6 space-y-2.5 border-t border-lp-line pt-5 text-[13px]">
            {[
              ["Base imponible", "1.000,00 €"],
              ["IVA (21 %)", "210,00 €"],
              ["IRPF (−15 %)", "−150,00 €"],
            ].map(([d, v]) => (
              <div key={d} className="flex justify-between text-lp-ink">
                <span>{d}</span>
                <span className="font-semibold tabular-nums text-lp-navy">{v}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-lp-line pt-3 text-base font-extrabold">
              <span>Total</span>
              <span className="tabular-nums">1.060,00 €</span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4 rounded-2xl bg-lp-soft p-3.5 ring-1 ring-lp-line">
            <div className="rounded-xl bg-white p-2 ring-1 ring-lp-line">
              <FakeQr className="h-16 w-16 text-lp-navy" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold">Factura verificable en la sede electrónica de la AEAT</p>
              <p className="mt-1 truncate text-[10px] tabular-nums text-lp-ink">Huella · 3C4F…A91B ← 7E02…D5C8</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Contenido ────────────────────────────────────────────────────────────────

const PAINS = [
  {
    icon: FileText, tile: "bg-lp-blue/[0.08] text-lp-blue",
    title: "Documentos por todas partes",
    desc: "Facturas en el correo, archivos en carpetas y documentos que cuesta encontrar justo cuando hacen falta.",
  },
  {
    icon: Repeat, tile: "bg-lp-violet/[0.08] text-lp-violet",
    title: "Tareas que se repiten",
    desc: "Copiar los mismos datos del pedido al albarán y del albarán a la factura añade trabajo y errores.",
  },
  {
    icon: Send, tile: "bg-cyan-50 text-cyan-700",
    title: "Preparar todo para la gestoría",
    desc: "Recopilar, ordenar y enviar la documentación de cada trimestre no debería ser una tarea interminable.",
  },
]

const EXTRAS: { icon: LucideIcon; label: string }[] = [
  { icon: Bell, label: "Alertas de vencimiento" },
  { icon: BarChart3, label: "Cobros y gastos del mes" },
  { icon: Search, label: "Búsqueda avanzada" },
  { icon: Download, label: "Exportación CSV/Excel" },
  { icon: Mail, label: "Envío de facturas por correo" },
  { icon: Globe, label: "Español e inglés" },
]

const STEPS = [
  {
    title: "Crea tu cuenta",
    desc: "En un par de minutos y sin tarjeta. Añade los datos de tu negocio, tus clientes y tus productos, o impórtalos desde Excel.",
  },
  {
    title: "Factura y archiva",
    desc: "Emite pedidos, albaranes y facturas, y sube las facturas de compra y el resto de documentos a tu archivo.",
  },
  {
    title: "Compártelo con tu gestoría",
    desc: "Invita a tu gestor con acceso de solo lectura a las carpetas que tú decidas, o exporta y envía lo que necesite.",
  },
]

const CHAIN: { icon: LucideIcon; label: string; sub: string; tile: string; done: boolean }[] = [
  { icon: FolderOpen, label: "Pedido", sub: "Origen de la operación", tile: "bg-lp-blue/10 text-lp-blue", done: true },
  { icon: Truck, label: "Albarán", sub: "Se abre solo a partir del pedido", tile: "bg-slate-100 text-lp-deep", done: true },
  { icon: FileText, label: "Factura emitida", sub: "Con huella y QR VeriFactu", tile: "bg-lp-violet/10 text-lp-violet", done: false },
  { icon: HandCoins, label: "Cobro", sub: "Forma de pago y fecha de cobro", tile: "bg-emerald-50 text-emerald-600", done: false },
]

const FAQ: { q: string; a: string }[] = [
  {
    q: "¿Puedo compartir la documentación con mi gestoría?",
    a: "Sí. Puedes invitar a tu gestor como usuario con acceso de solo lectura y descarga a las carpetas que tú autorices, exportar listados a CSV o Excel y enviar documentos por correo desde la propia aplicación.",
  },
  {
    q: "¿Archivum está preparado para VeriFactu?",
    a: "Cada factura que emites genera su registro con huella encadenada y código QR de cotejo, y Archivum está preparado para remitirlo a la AEAT con tu certificado digital, que se guarda cifrado. Si tu negocio no está obligado en España, puedes indicarlo en Ajustes.",
  },
  ...PRICING_FAQ,
  {
    q: "¿Necesito instalar algo?",
    a: "No. Archivum funciona en el navegador, desde el ordenador o el móvil. No hay nada que instalar ni que mantener.",
  },
]

// ── Página ───────────────────────────────────────────────────────────────────

export function LandingPage() {
  const container = "mx-auto w-full max-w-6xl px-4 sm:px-6"

  return (
    <div className="lp-root min-h-[100dvh] overflow-x-clip bg-white text-lp-navy" id="inicio">
      <LandingNav />

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="relative -mt-[4.25rem] overflow-hidden pt-[4.25rem] sm:-mt-[5.25rem] sm:pt-[5.25rem]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,#f2f7ff_0%,#ffffff_52%,#f6f2ff_100%)]" />
          <div className="pointer-events-none absolute -right-48 -top-56 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(86,224,235,0.26),rgba(117,49,182,0.07)_55%,transparent_72%)]" />
          <div className="pointer-events-none absolute -left-40 bottom-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(0,95,194,0.09),transparent_70%)]" />

          <div className={`${container} relative grid items-center gap-14 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 lg:pb-32 lg:pt-24`}>
            <div>
              <div className="lp-enter">
                <Eyebrow>Para autónomos y pequeños negocios</Eyebrow>
              </div>
              <h1
                className="lp-enter mt-6 max-w-[15ch] text-balance text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.055em] text-lp-navy sm:text-6xl lg:text-[4.1rem]"
                style={delay(80)}
              >
                Tus facturas y documentos,{" "}
                <span className="bg-[linear-gradient(95deg,#005fc2,#7531b6)] bg-clip-text text-transparent">
                  en orden y listos para tu gestoría.
                </span>
              </h1>
              <p className="lp-enter mt-6 max-w-xl text-pretty text-base leading-[1.75] text-lp-ink sm:text-lg" style={delay(160)}>
                Factura, organiza tus documentos y compártelos con tu gestoría desde un mismo lugar.
                Sin depender de Excel, carpetas, correos y papeles.
              </p>
              <div className="lp-enter mt-8 flex flex-col gap-3 sm:flex-row" style={delay(240)}>
                <Cta href="/auth/signup">Empezar gratis</Cta>
                <Cta href="#como-funciona" variant="ghost">Ver cómo funciona</Cta>
              </div>
              <ul className="lp-enter mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-lp-ink" style={delay(320)}>
                {["Plan gratuito para siempre", "Sin tarjeta", "Preparado para VeriFactu"].map(t => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.25} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-enter" style={delay(280)}>
              <HeroMock />
            </div>
          </div>
        </section>

        {/* ── Problema ───────────────────────────────────────────────────── */}
        <section className="py-24 sm:py-32" id="problema">
          <div className={container}>
            <SectionHead eyebrow="Menos dispersión, más claridad" title="¿Tú también tienes documentos repartidos por todas partes?">
              Facturas en el correo, documentos en carpetas, datos en Excel y papeles pendientes de
              enviar a la gestoría. ¿Te resulta familiar?
            </SectionHead>
            <div className="grid gap-4 md:grid-cols-3">
              {PAINS.map(p => (
                <Bezel key={p.title} className="lp-reveal" innerClassName="p-7">
                  <IconTile icon={p.icon} className={p.tile} />
                  <h3 className="mt-6 text-lg font-bold tracking-[-0.02em]">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-lp-ink">{p.desc}</p>
                </Bezel>
              ))}
            </div>
            <p className="lp-reveal mt-12 flex items-center justify-center gap-4 text-center text-sm font-bold text-lp-blue">
              <span className="hidden h-px w-14 bg-lp-blue/20 sm:block" />
              Deja atrás los documentos dispersos. Tenlo todo organizado en un solo lugar.
              <span className="hidden h-px w-14 bg-lp-blue/20 sm:block" />
            </p>
          </div>
        </section>

        {/* ── Beneficios (bento) ─────────────────────────────────────────── */}
        <section className="bg-lp-soft py-24 sm:py-32" id="beneficios">
          <div className={container}>
            <SectionHead eyebrow="Una gestión más sencilla" title="Menos herramientas dispersas. Menos tiempo en tareas administrativas.">
              Ten tus facturas y documentos en orden, encuéntralos cuando los necesites y compártelos
              con tu gestoría sin complicaciones.
            </SectionHead>

            <div className="grid gap-4 lg:grid-cols-6">
              <Bezel className="lp-reveal lg:col-span-4" innerClassName="grid gap-8 p-7 sm:p-9 md:grid-cols-[1fr_1.05fr] md:items-center">
                <div>
                  <IconTile icon={Receipt} className="bg-lp-blue/[0.08] text-lp-blue" />
                  <h3 className="mt-6 text-2xl font-extrabold tracking-[-0.035em]">Emisión de facturas</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-lp-ink">
                    Líneas de producto, IVA e IRPF calculados automáticamente, numeración correlativa
                    y PDF profesional. En euros, dólares o libras.
                  </p>
                </div>
                <div className="rounded-2xl bg-lp-soft p-4 ring-1 ring-lp-line" aria-hidden="true">
                  {[
                    ["Instalación eléctrica", "2 × 380,00", "760,00 €"],
                    ["Cuadro de mandos", "1 × 240,00", "240,00 €"],
                  ].map(([d, q, t]) => (
                    <div key={d} className="flex items-center gap-3 border-b border-lp-line py-2.5 text-[12px]">
                      <span className="flex-1 truncate font-semibold">{d}</span>
                      <span className="hidden tabular-nums text-lp-ink sm:block">{q}</span>
                      <span className="font-bold tabular-nums">{t}</span>
                    </div>
                  ))}
                  <div className="space-y-1.5 pt-3 text-[11.5px] text-lp-ink">
                    <div className="flex justify-between"><span>IVA 21 %</span><span className="tabular-nums">210,00 €</span></div>
                    <div className="flex justify-between"><span>IRPF −15 %</span><span className="tabular-nums">−150,00 €</span></div>
                    <div className="flex justify-between pt-1 text-sm font-extrabold text-lp-navy"><span>Total</span><span className="tabular-nums">1.060,00 €</span></div>
                  </div>
                </div>
              </Bezel>

              <Bezel className="lp-reveal lg:col-span-2" innerClassName="flex flex-col p-7 sm:p-9">
                <IconTile icon={ShieldCheck} className="bg-emerald-50 text-emerald-600" />
                <h3 className="mt-6 text-xl font-extrabold tracking-[-0.03em]">Preparado para VeriFactu</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-lp-ink">
                  Facturas con huella encadenada y QR de cotejo de la AEAT, pensadas para el nuevo
                  sistema de facturación verificable.
                </p>
                <a href="#verifactu" className="group mt-auto inline-flex items-center gap-1 pt-6 text-sm font-bold text-lp-blue">
                  Ver cómo funciona
                  <ChevronRight className="h-4 w-4 transition-transform duration-500 ease-lp group-hover:translate-x-1" {...ICON} />
                </a>
              </Bezel>

              {[
                {
                  icon: Package, tile: "bg-lp-violet/[0.08] text-lp-violet", title: "Inventario y catálogo",
                  desc: "Productos y servicios por categorías, con stock y aviso de mínimo. Añádelos a tus facturas en un clic.",
                },
                {
                  icon: FolderOpen, tile: "bg-lp-blue/[0.08] text-lp-blue", title: "Archivo centralizado",
                  desc: "Facturas de venta y de compra, albaranes, pedidos y recibos en un único lugar, con carpetas, filtros y búsqueda.",
                },
                {
                  icon: Building2, tile: "bg-amber-50 text-amber-600", title: "Clientes y proveedores",
                  desc: "Sus datos fiscales siempre a mano, con su forma de pago y vencimiento. Reutilízalos en cada documento.",
                },
              ].map(c => (
                <Bezel key={c.title} className="lp-reveal lg:col-span-2" innerClassName="p-7 sm:p-9">
                  <IconTile icon={c.icon} className={c.tile} />
                  <h3 className="mt-6 text-xl font-extrabold tracking-[-0.03em]">{c.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-lp-ink">{c.desc}</p>
                </Bezel>
              ))}

              <Bezel className="lp-reveal lg:col-span-6" innerClassName="grid gap-7 p-7 sm:p-9 md:grid-cols-[1.2fr_1fr] md:items-center">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <IconTile icon={Users} className="shrink-0 bg-rose-50 text-rose-600" />
                  <div>
                    <h3 className="text-xl font-extrabold tracking-[-0.03em]">Equipo y gestoría, cada uno con su acceso</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-lp-ink">
                      Invita a tu equipo y a tu gestor. El administrador decide qué carpetas puede ver
                      y descargar cada persona.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2" aria-hidden="true">
                  {[
                    ["Administrador", "Acceso completo", "bg-lp-blue/10 text-lp-blue"],
                    ["Colaborador", "Solo los clientes asignados", "bg-lp-violet/10 text-lp-violet"],
                    ["Visor · tu gestoría", "Solo lectura y descarga", "bg-emerald-50 text-emerald-700"],
                  ].map(([role, what, cls]) => (
                    <div key={role} className="flex items-center justify-between gap-3 rounded-xl bg-lp-soft px-4 py-2.5 ring-1 ring-lp-line">
                      <span className="text-[13px] font-bold">{role}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{what}</span>
                    </div>
                  ))}
                </div>
              </Bezel>
            </div>

            <div className="lp-reveal mt-10 flex flex-wrap items-center justify-center gap-2.5">
              <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.16em] text-lp-ink">Y además</span>
              {EXTRAS.map(e => (
                <span key={e.label} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-lp-navy ring-1 ring-lp-line">
                  <e.icon className="h-3.5 w-3.5 text-lp-blue" {...ICON} />
                  {e.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── VeriFactu ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-[linear-gradient(120deg,#0f2747_0%,#013a92_62%,#4a2a93_100%)] py-24 text-white sm:py-32" id="verifactu">
          <div className="pointer-events-none absolute -right-28 -top-52 h-[480px] w-[480px] rounded-full border border-lp-cyan/20 shadow-[0_0_0_44px_rgba(86,224,235,0.04),0_0_0_100px_rgba(86,224,235,0.03)]" />
          <div className={`${container} relative grid items-center gap-14 lg:grid-cols-2 lg:gap-16`}>
            <div className="lp-reveal">
              <Eyebrow tone="dark">Facturación verificable</Eyebrow>
              <h2 className="mt-6 text-balance text-[2rem] font-extrabold leading-[1.1] tracking-[-0.045em] sm:text-[2.9rem]">
                Facturas listas para la era VERI*FACTU
              </h2>
              <p className="mt-5 max-w-xl text-pretty text-base leading-[1.75] text-blue-100/85 sm:text-lg">
                Cada factura que emites incorpora su huella encadenada y el código QR de cotejo de
                la AEAT. Sube tu certificado digital una vez y Archivum prepara y remite el registro
                de cada factura, sin software extra.
              </p>
              <ul className="mt-8 grid gap-4">
                {[
                  "Huella criptográfica encadenada entre facturas",
                  "Código QR de cotejo en la sede de la AEAT",
                  "Certificado digital cifrado por organización",
                  "Rectificativas y anulaciones con su propio registro",
                ].map(t => (
                  <li key={t} className="flex items-start gap-3 text-[15px] text-blue-50">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/40">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/declaracion-responsable"
                className="group mt-9 inline-flex items-center gap-1 text-sm font-bold text-lp-cyan"
              >
                Declaración responsable del sistema
                <ChevronRight className="h-4 w-4 transition-transform duration-500 ease-lp group-hover:translate-x-1" {...ICON} />
              </Link>
            </div>
            <InvoiceMock />
          </div>
        </section>

        {/* ── Cómo funciona ──────────────────────────────────────────────── */}
        <section className="py-24 sm:py-32" id="como-funciona">
          <div className={container}>
            <SectionHead eyebrow="Cómo funciona" title="Factura, archiva y comparte con tu gestoría. Sin complicaciones.">
              Agiliza las tareas recurrentes que más tiempo te quitan. Empieza por lo que necesitas y
              amplía cuando tu negocio lo requiera.
            </SectionHead>

            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="lp-reveal">
                  <Bezel className="h-full" innerClassName="p-7 sm:p-8">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#005fc2,#7531b6)] text-base font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(0,95,194,0.6)]">
                      {i + 1}
                    </span>
                    <h3 className="mt-6 text-lg font-bold tracking-[-0.02em]">{s.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-lp-ink">{s.desc}</p>
                  </Bezel>
                </li>
              ))}
            </ol>

            {/* Flujo documental */}
            <div className="mt-24 grid items-center gap-12 sm:mt-32 lg:grid-cols-2 lg:gap-20" id="flujo-documental">
              <div className="lp-reveal">
                <Eyebrow>Flujo documental</Eyebrow>
                <h2 className="mt-5 text-balance text-[2rem] font-extrabold leading-[1.1] tracking-[-0.045em] sm:text-[2.6rem]">
                  Conecta cada documento con su origen
                </h2>
                <p className="mt-5 max-w-lg text-pretty text-base leading-[1.75] text-lp-ink sm:text-[17px]">
                  Desde un pedido se genera el albarán, y desde el albarán, la factura. Toda la cadena
                  queda conectada y visible, sin duplicar datos.
                </p>
                <Cta href="/auth/signup" className="mt-8">Probarlo gratis</Cta>
              </div>

              <Bezel className="lp-reveal lg:ml-auto lg:w-full lg:max-w-[30rem]" innerClassName="p-6 sm:p-8">
                <div aria-label="Ejemplo del flujo documental conectado">
                  {CHAIN.map((c, i) => (
                    <div key={c.label}>
                      <div className="flex items-center gap-4">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.tile}`}>
                          <c.icon className="h-5 w-5" {...ICON} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-bold">{c.label}</p>
                          <p className="text-[13px] text-lp-ink">{c.sub}</p>
                        </div>
                        {c.done ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </span>
                        ) : (
                          <ChevronRight className="h-5 w-5 text-lp-ink/40" {...ICON} />
                        )}
                      </div>
                      {i < CHAIN.length - 1 && <div className="my-1.5 ml-[21px] h-6 border-l-2 border-dashed border-lp-line" />}
                    </div>
                  ))}
                </div>
              </Bezel>
            </div>
          </div>
        </section>

        {/* ── Planes ─────────────────────────────────────────────────────── */}
        <section className="bg-lp-soft py-24 sm:py-32" id="planes">
          <div className={container}>
            <SectionHead eyebrow="Planes claros" title="Un plan para cada momento de tu negocio.">
              Empieza gratis y amplía tu capacidad cuando lo necesites. La cuota de documentos que no
              consumes se acumula al mes siguiente. Sin permanencia.
            </SectionHead>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
              {Object.values(PLANS).map(plan => (
                <div
                  key={plan.id}
                  className={`lp-reveal relative rounded-[1.75rem] p-1.5 ${
                    plan.highlight
                      ? "bg-[linear-gradient(160deg,#005fc2,#7531b6)] shadow-[0_30px_60px_-28px_rgba(0,95,194,0.6)] lg:-translate-y-3"
                      : "bg-lp-navy/[0.035] ring-1 ring-lp-navy/[0.06]"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-lp-navy px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                      {plan.badge}
                    </span>
                  )}
                  <div className="flex h-full flex-col rounded-[calc(1.75rem-0.375rem)] bg-white p-6">
                    <p className="text-sm font-extrabold">{plan.name}</p>
                    <p className="mt-1.5 min-h-[3.5rem] text-[13px] leading-snug text-lp-ink">{plan.description}</p>
                    <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                      <span className="text-[2.1rem] font-extrabold tracking-[-0.05em] tabular-nums">{plan.priceLabel}</span>
                      <span className="text-xs font-semibold text-lp-ink">{plan.priceSuffix}</span>
                    </p>
                    <ul className="mt-6 flex-1 space-y-2.5 border-t border-lp-line pt-6">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-[13px] leading-snug text-lp-ink">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lp-blue" strokeWidth={2.25} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/auth/signup"
                      className={`mt-7 block rounded-full py-3 text-center text-sm font-bold transition-[background-color,box-shadow,transform] duration-500 ease-lp active:scale-[0.98] ${
                        plan.highlight
                          ? "bg-lp-blue text-white hover:bg-lp-deep"
                          : "text-lp-navy ring-1 ring-lp-navy/12 hover:ring-lp-navy/30"
                      }`}
                    >
                      {plan.price === 0 ? "Crear cuenta gratis" : `Elegir ${plan.name}`}
                    </Link>
                    <p className="mt-2.5 text-center text-[11px] text-lp-ink">
                      {plan.price === 0 ? "Sin tarjeta · Para siempre" : "Sin permanencia"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="lp-reveal mt-6 text-center text-xs text-lp-ink">
              Precios mensuales sin IVA (21 %). Se empieza siempre con la cuenta gratuita y el plan se contrata desde dentro.
            </p>

            <div className="lp-reveal mt-14">
              <h3 className="text-center text-xl font-extrabold tracking-[-0.03em]">Amplía tu plan cuando lo necesites</h3>
              <div className="mx-auto mt-6 grid max-w-4xl gap-4 md:grid-cols-2">
                {Object.values(ADDONS).map(a => (
                  <Bezel key={a.label} innerClassName="flex items-center justify-between gap-4 p-6">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold">{a.label}</p>
                      <p className="mt-1 text-[13px] text-lp-ink">{a.sublabel}</p>
                    </div>
                    <p className="whitespace-nowrap text-lg font-extrabold tracking-[-0.03em] text-lp-blue">{a.priceLabel}</p>
                  </Bezel>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Preguntas ──────────────────────────────────────────────────── */}
        <section className="py-24 sm:py-32" id="preguntas">
          <div className={container}>
            <SectionHead eyebrow="Preguntas frecuentes" title="Lo que quizá quieras saber antes de empezar." />
            <div className="mx-auto grid max-w-3xl gap-3">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="lp-reveal group rounded-2xl bg-lp-soft ring-1 ring-lp-line open:shadow-[0_18px_40px_-26px_rgba(26,45,73,0.35)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 rounded-2xl px-5 py-5 text-[15px] font-bold [&::-webkit-details-marker]:hidden sm:px-6">
                    {q}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lp-blue/[0.07] text-lp-blue transition-transform duration-500 ease-lp group-open:rotate-45">
                      <Plus className="h-4 w-4" {...ICON} />
                    </span>
                  </summary>
                  <p className="px-5 pb-6 text-[15px] leading-relaxed text-lp-ink sm:px-6">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA final ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-lp-soft py-24 sm:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_100%,rgba(0,95,194,0.09),transparent)]" />
          <div className={`${container} lp-reveal relative text-center`}>
            <h2 className="mx-auto max-w-3xl text-balance text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.05em] sm:text-[3.25rem]">
              Tus facturas y documentos, en orden y listos para tu gestoría.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-lp-ink sm:text-[17px]">
              Empieza a organizar tu documentación en un solo lugar y descubre si Archivum encaja con
              tu negocio.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Cta href="/auth/signup">Crear cuenta gratis</Cta>
              <Cta href="/auth/login" variant="ghost">Ya tengo cuenta</Cta>
            </div>
          </div>
        </section>
      </main>

      {/* ── Pie ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-lp-line bg-white">
        <div className={`${container} flex flex-col items-center justify-between gap-5 py-9 text-xs text-muted-foreground lg:flex-row`}>
          <div className="flex flex-col items-center gap-2 lg:items-start">
            <Logo size={26} textClassName="text-lp-navy text-sm font-extrabold tracking-[-0.03em]" />
            <p>Una gestión más sencilla para pequeños negocios.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {/* LSSI art. 10: el aviso legal tiene que estar a un clic desde la web. */}
            <Link href="/terminos" className="transition-colors hover:text-foreground">Aviso legal</Link>
            <Link href="/privacidad" className="transition-colors hover:text-foreground">Privacidad</Link>
            <Link href="/cookies" className="transition-colors hover:text-foreground">Cookies</Link>
            {/* Art. 13.2: available to the client at the moment of acquisition,
                which means reachable without an account. */}
            <Link href="/declaracion-responsable" className="transition-colors hover:text-foreground">Declaración responsable</Link>
            <Link href="/auth/login" className="transition-colors hover:text-foreground">Iniciar sesión</Link>
            <Link href="/auth/signup" className="transition-colors hover:text-foreground">Registro</Link>
          </div>
        </div>
        <div className={`${container} flex flex-col items-center justify-between gap-3 border-t border-lp-line py-5 text-xs text-muted-foreground sm:flex-row`}>
          <p>© {new Date().getFullYear()} Archivum. Todos los derechos reservados.</p>
          {/* Crédito del estudio que diseñó la web (enlace con UTM para medir las visitas que llegan desde aquí) */}
          <LumenCredit />
        </div>
      </footer>
    </div>
  )
}
