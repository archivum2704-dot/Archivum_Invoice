import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import { Fraunces, Geist, Geist_Mono } from "next/font/google"
import { Logo } from "@/components/logo"
import { LumenCredit } from "@/components/lumen-credit"
import { PLANS, ADDONS, PRICING_FAQ } from "@/lib/pricing"
import { LandingNav } from "./landing-nav"

/*
 * Landing pública. El contenido parte del prototipo «Archivum_Landing_v02»;
 * el diseño es propio: la página se compone como un documento (papel, tinta,
 * filetes, números tabulares), sin tarjetas, degradados ni iconos de serie.
 *
 *  - Planes y precios salen de lib/pricing.ts (fuente única), no del prototipo.
 *  - Sin reserva de llamadas (el prototipo traía un calendario de boceto).
 *  - VeriFactu: «Preparado para», nunca «conforme» ni «cumple» (ver CLAUDE.md).
 *  - Las facturas, clientes y huellas que se ven son de ejemplo.
 */

const serif = Fraunces({ subsets: ["latin"], variable: "--font-lp-serif", axes: ["opsz", "SOFT"], style: ["normal", "italic"] })
const sans = Geist({ subsets: ["latin"], variable: "--font-lp-sans" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-lp-mono" })

const WRAP = "mx-auto w-full max-w-[1240px] px-5 sm:px-8"

function vars(v: Record<string, string>): CSSProperties {
  return v as CSSProperties
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 10" className={`h-2.5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <path d="M0 5h18M14 1l4 4-4 4" />
    </svg>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 12 12" className="mt-[5px] h-3 w-3 shrink-0 text-lp-accent" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M1.5 6.5l3 3 6-7" />
    </svg>
  )
}

function Button({ href, children, tone = "ink" }: { href: string; children: ReactNode; tone?: "ink" | "accent" }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-4 rounded-[5px] px-6 py-3.5 text-[15px] font-medium text-lp-paper transition-[background-color,transform] duration-300 ease-lp active:translate-y-px ${
        tone === "ink" ? "bg-lp-ink hover:bg-lp-accent" : "bg-lp-accent hover:bg-lp-ink"
      }`}
    >
      {children}
      <Arrow className="transition-transform duration-500 ease-lp group-hover:translate-x-1" />
    </Link>
  )
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  const cls = "group inline-flex items-center gap-3 text-[15px] text-lp-ink underline decoration-lp-rule decoration-1 underline-offset-[7px] transition-colors duration-300 hover:decoration-lp-ink"
  const inner = (
    <>
      {children}
      <Arrow className="text-lp-dim transition-transform duration-500 ease-lp group-hover:translate-x-1" />
    </>
  )
  return href.startsWith("/") ? <Link href={href} className={cls}>{inner}</Link> : <a href={href} className={cls}>{inner}</a>
}

/** Margen del documento: número de sección y rótulo, a la izquierda del contenido. */
function Margin({ n, label }: { n: string; label: string }) {
  return (
    <p className="lp-mono flex items-baseline gap-3 text-[12px] text-lp-dim lg:sticky lg:top-24 lg:self-start">
      <span className="text-lp-accent">{n}</span>
      <span className="h-px w-6 translate-y-[-3px] bg-lp-rule" />
      {label}
    </p>
  )
}

function Section({ id, n, label, children, band = false }: { id: string; n: string; label: string; children: ReactNode; band?: boolean }) {
  return (
    <section id={id} className={`border-t border-lp-rule ${band ? "bg-lp-band" : ""}`}>
      <div className={`${WRAP} grid gap-x-10 gap-y-8 pb-24 pt-14 sm:pb-36 sm:pt-20 lg:grid-cols-12`}>
        <div className="lg:col-span-3">
          <Margin n={n} label={label} />
        </div>
        <div className="lg:col-span-9">{children}</div>
      </div>
    </section>
  )
}

// ── La factura del hero ──────────────────────────────────────────────────────

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

const SHEET = "lp-sheet absolute rounded-[3px] bg-lp-sheet shadow-[0_1px_0_rgba(23,32,43,0.06),0_30px_60px_-30px_rgba(60,45,20,0.45)] ring-1 ring-lp-ink/[0.07]"

function PaperStack() {
  const lines = [
    ["Puerta de roble a medida", "2", "412,50", "825,00"],
    ["Instalación y ajuste (h)", "3", "38,00", "114,00"],
    ["Herrajes y bisagras", "1", "46,80", "46,80"],
  ]
  return (
    <div className="lp-stack relative mx-auto aspect-[10/14.6] w-full max-w-[470px] sm:aspect-[10/12.6]" aria-hidden="true">
      {/* Pedido y albarán: asoman por detrás, de ahí sale la factura */}
      <div
        className={`${SHEET} inset-x-[7%] top-0 h-[88%]`}
        style={vars({ "--lp-rot": "-5.5deg", "--lp-rot-from": "-2deg", "--lp-rot-hover": "-7deg", "--lp-delay": "250ms" })}
      >
        <p className="lp-mono flex justify-between px-5 pt-4 text-[10px] text-lp-dim">
          <span>PEDIDO</span><span>PED-2026-0139</span>
        </p>
      </div>
      <div
        className={`${SHEET} inset-x-[4%] top-[3.5%] h-[90%]`}
        style={vars({ "--lp-rot": "3.2deg", "--lp-rot-from": "1deg", "--lp-rot-hover": "4.6deg", "--lp-delay": "380ms" })}
      >
        <p className="lp-mono flex justify-between px-5 pt-4 text-[10px] text-lp-dim">
          <span>ALBARÁN</span><span>ALB-2026-0152</span>
        </p>
      </div>

      {/* Factura */}
      <div
        className={`${SHEET} inset-x-0 bottom-0 top-[8%] flex flex-col p-6 text-lp-ink sm:p-8`}
        style={vars({ "--lp-rot": "-1.1deg", "--lp-rot-from": "0deg", "--lp-rot-hover": "0deg", "--lp-lift": "-6px", "--lp-delay": "520ms" })}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="lp-serif text-[26px] leading-none tracking-[-0.02em] sm:text-[30px]">Factura</p>
            <p className="lp-mono mt-2 text-[11px] text-lp-dim">FAC-2026-0147</p>
          </div>
          <div className="lp-mono text-right text-[10px] leading-[1.7] text-lp-dim">
            <p>Emitida 10/11/2026</p>
            <p>Vence 10/12/2026</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-y border-lp-rule py-4 text-[11px] leading-[1.6]">
          <div>
            <p className="lp-mono text-[9.5px] text-lp-dim">De</p>
            <p className="font-medium">Carpintería Olmedo, S.L.</p>
            <p className="text-lp-dim">Aranda de Duero, Burgos</p>
          </div>
          <div>
            <p className="lp-mono text-[9.5px] text-lp-dim">Para</p>
            <p className="font-medium">Reformas Villalba</p>
            <p className="text-lp-dim">Lerma, Burgos</p>
          </div>
        </div>

        <table className="mt-4 w-full text-[11px]">
          <thead>
            <tr className="lp-mono text-left text-[9.5px] text-lp-dim">
              <th className="pb-2 font-normal">Concepto</th>
              <th className="pb-2 text-right font-normal">Cant.</th>
              <th className="hidden pb-2 text-right font-normal sm:table-cell">Precio</th>
              <th className="pb-2 text-right font-normal">Importe</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(([c, q, p, t]) => (
              <tr key={c} className="border-t border-lp-rule/70">
                <td className="py-2 pr-2">{c}</td>
                <td className="lp-mono py-2 text-right text-lp-dim">{q}</td>
                <td className="lp-mono hidden py-2 text-right text-lp-dim sm:table-cell">{p}</td>
                <td className="lp-mono py-2 text-right">{t}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <div className="flex items-center gap-3">
            <FakeQr className="h-[58px] w-[58px] shrink-0 text-lp-ink" />
            <p className="lp-mono max-w-[13ch] text-[8.5px] leading-[1.5] text-lp-dim">Factura verificable en la sede electrónica de la AEAT</p>
          </div>
          <dl className="lp-mono w-[46%] text-[11px]">
            <div className="flex justify-between py-0.5 text-lp-dim"><dt>Base</dt><dd>985,80</dd></div>
            <div className="flex justify-between py-0.5 text-lp-dim"><dt>IVA 21 %</dt><dd>207,02</dd></div>
            <div className="mt-1.5 flex justify-between border-t border-lp-ink pt-2 text-[14px] font-medium text-lp-ink"><dt>Total</dt><dd>1.192,82 €</dd></div>
          </dl>
        </div>

        {/* Sello */}
        <div className="lp-stamp lp-mono absolute bottom-[24%] left-[26%] rounded-[4px] sm:bottom-[25%] sm:left-auto sm:right-[9%] border-[1.5px] border-lp-accent px-3.5 py-2.5 text-center text-lp-accent outline outline-1 outline-offset-2 outline-lp-accent/60">
          <p className="text-[15px] font-medium tracking-[0.14em]">VERI*FACTU</p>
          <p className="mt-0.5 text-[8px] tracking-[0.08em]">HUELLA 3C4F…A91B</p>
        </div>
      </div>
    </div>
  )
}

// ── Contenido ────────────────────────────────────────────────────────────────

const MESS = [
  "factura_final_v3 (2).pdf",
  "Albaranes marzo DEFINITIVO.xlsx",
  "IMG_4821.jpg",
  "RE: RE: Fwd: facturas 3T para la gestoría",
  "presupuesto garcía (copia).docx",
]

const ORDERED = [
  ["FAC-2026-0147", "Reformas Villalba", "1.192,82 €", "Emitida"],
  ["ALB-2026-0152", "Reformas Villalba", "1.192,82 €", "Facturado"],
  ["PED-2026-0139", "Reformas Villalba", "1.192,82 €", "Aceptado"],
  ["FAC-2026-0146", "Bodegas Ribera Alta", "3.418,25 €", "Cobrada"],
  ["Recibida · 2026/388", "Maderas del Duero", "764,10 €", "Pagada"],
]

const FEATURES = [
  {
    title: "Facturas",
    desc: "Líneas de producto, IVA e IRPF calculados, numeración correlativa y PDF listo para enviar. En euros, dólares o libras.",
    detail: "FAC-2026-0147",
  },
  {
    title: "Pedidos y albaranes",
    desc: "El albarán sale del pedido y la factura del albarán. Nadie vuelve a teclear los mismos datos.",
    detail: "PED → ALB → FAC",
  },
  {
    title: "Archivo",
    desc: "Facturas de venta y de compra, albaranes, pedidos y recibos en un mismo sitio, con carpetas, filtros y buscador.",
    detail: "CSV · Excel · PDF",
  },
  {
    title: "Inventario",
    desc: "Productos y servicios por categorías. El stock baja al facturar, sube con las compras y avisa al llegar al mínimo.",
    detail: "Stock mín. 12 uds.",
  },
  {
    title: "Clientes y proveedores",
    desc: "Sus datos fiscales, su forma de pago y su vencimiento, guardados una vez y propuestos en cada documento.",
    detail: "NIF · 30 días",
  },
  {
    title: "Cobros y vencimientos",
    desc: "Qué está cobrado, qué queda pendiente y qué ha vencido, sin cuadrar nada a mano.",
    detail: "Vence 10/12/2026",
  },
]

const CHAIN_RECORDS = [
  { num: "FAC-2026-0145", prev: "77B0…C3D1", hash: "9F2C…41AE" },
  { num: "FAC-2026-0146", prev: "9F2C…41AE", hash: "E81A…0B57" },
  { num: "FAC-2026-0147", prev: "E81A…0B57", hash: "3C4F…A91B" },
]

const FLOW = [
  { code: "PED", title: "Pedido", desc: "Lo que te encargan, con sus líneas y su precio." },
  { code: "ALB", title: "Albarán", desc: "Se abre solo a partir del pedido. Es lo que entregas." },
  { code: "FAC", title: "Factura", desc: "Sale del albarán, con su huella y su QR." },
  { code: "€", title: "Cobro", desc: "Forma de pago, vencimiento y fecha de cobro." },
]

const ROLES = [
  { role: "Administrador", who: "Tú", can: "Acceso completo: emite, archiva, gestiona usuarios y decide quién ve qué." },
  { role: "Colaborador", who: "Tu equipo", can: "Trabaja solo con los clientes que le asignes." },
  { role: "Visor", who: "Tu gestoría", can: "Consulta y descarga las carpetas que le autorices. No puede subir, editar ni borrar." },
]

const FAQ: { q: string; a: string }[] = [
  {
    q: "¿Puedo compartir la documentación con mi gestoría?",
    a: "Sí. Invitas a tu gestor como usuario con acceso de solo lectura y descarga a las carpetas que tú autorices. También puedes exportar listados a CSV o Excel y enviar documentos por correo desde la aplicación.",
  },
  {
    q: "¿Archivum está preparado para VeriFactu?",
    a: "Cada factura que emites genera su registro con huella encadenada y código QR de cotejo, y Archivum está preparado para remitirlo a la AEAT con tu certificado digital, que se guarda cifrado. Si tu negocio no está obligado en España, lo indicas en Ajustes.",
  },
  ...PRICING_FAQ,
  {
    q: "¿Necesito instalar algo?",
    a: "No. Archivum funciona en el navegador, desde el ordenador o el móvil.",
  },
]

// es-ES no agrupa los millares de cuatro cifras (2400); aquí sí se quiere 2.400.
const fmt = (n: number) => String(n).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")

// ── Página ───────────────────────────────────────────────────────────────────

export function LandingPage() {
  const plans = Object.values(PLANS)

  return (
    <div
      id="inicio"
      className={`lp-root ${serif.variable} ${sans.variable} ${mono.variable} min-h-[100dvh] overflow-x-clip bg-lp-paper text-lp-ink antialiased`}
    >
      <div className="lp-grain z-50" aria-hidden="true" />
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-lp-ink focus:px-4 focus:py-2 focus:text-lp-paper">
        Saltar al contenido
      </a>
      <LandingNav />

      <main id="contenido">
        {/* ── Portada ────────────────────────────────────────────────────── */}
        <section className={`${WRAP} grid items-center gap-x-10 gap-y-16 pb-20 pt-12 sm:pt-16 lg:grid-cols-12 lg:pb-28 lg:pt-20`}>
          <div className="lg:col-span-7">
            <p className="lp-enter lp-mono text-[12px] text-lp-dim">
              Facturación y archivo para autónomos y pequeños negocios
            </p>
            <h1
              className="lp-enter lp-serif mt-7 text-[2.9rem] leading-[0.98] tracking-[-0.035em] sm:text-[4.4rem] lg:text-[5.1rem]"
              style={vars({ "--lp-delay": "90ms" })}
            >
              Tus facturas y documentos, <em className="text-lp-accent">en orden</em>.
              <span className="mt-2 block text-lp-dim sm:mt-3">Y listos para tu gestoría.</span>
            </h1>
            <p className="lp-enter mt-8 max-w-[52ch] text-[17px] leading-[1.7] text-lp-dim" style={vars({ "--lp-delay": "180ms" })}>
              Factura, archiva y comparte desde un mismo sitio. Sin depender de Excel, carpetas,
              correos y papeles que nunca aparecen cuando hacen falta.
            </p>
            <div className="lp-enter mt-10 flex flex-wrap items-center gap-x-8 gap-y-5" style={vars({ "--lp-delay": "270ms" })}>
              <Button href="/auth/signup">Crear cuenta gratis</Button>
              <TextLink href="#funciones">Ver qué hace</TextLink>
            </div>
            <p className="lp-enter lp-mono mt-7 text-[12px] text-lp-dim" style={vars({ "--lp-delay": "340ms" })}>
              Plan gratuito para siempre · Sin tarjeta
            </p>
          </div>
          <div className="lg:col-span-5">
            <PaperStack />
          </div>
        </section>

        {/* Renglón de datos, como el pie de un asiento contable */}
        <div className="border-t border-lp-rule">
          <dl className={`${WRAP} grid grid-cols-2 lg:grid-cols-4`}>
            {[
              ["0 €", "para empezar, sin tarjeta"],
              ["IVA + IRPF", "calculados en cada línea"],
              ["PED → ALB → FAC", "sin repetir un dato"],
              ["Huella + QR", "en cada factura emitida"],
            ].map(([k, v], i) => (
              <div key={k} className={`py-7 pr-4 ${i > 0 ? "lg:border-l lg:border-lp-rule lg:pl-8" : ""} ${i % 2 === 1 ? "border-l border-lp-rule pl-5 lg:pl-8" : ""} ${i > 1 ? "border-t border-lp-rule lg:border-t-0" : ""}`}>
                <dt className="lp-mono text-[15px] text-lp-ink sm:text-[17px]">{k}</dt>
                <dd className="mt-1.5 text-[13px] text-lp-dim">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── 01 · El desorden ───────────────────────────────────────────── */}
        <Section id="problema" n="01" label="El punto de partida">
          <h2 className="lp-reveal lp-serif max-w-[18ch] text-[2.3rem] leading-[1.04] tracking-[-0.03em] sm:text-[3.4rem]">
            ¿Tú también tienes los documentos repartidos por todas partes?
          </h2>
          <div className="mt-14 grid gap-x-14 gap-y-12 md:grid-cols-[0.9fr_1.1fr]">
            <div className="lp-reveal">
              <p className="lp-mono mb-4 text-[12px] text-lp-dim">Hoy</p>
              <ul className="lp-mono space-y-3.5 text-[13.5px] text-lp-dim">
                {MESS.map((m, i) => (
                  <li key={m} className="line-through decoration-lp-ink/40" style={{ paddingLeft: `${[0, 22, 6, 34, 14][i]}px` }}>
                    {m}
                  </li>
                ))}
              </ul>
              <p className="mt-9 max-w-[38ch] text-[15px] leading-[1.7] text-lp-dim">
                Facturas en el correo, datos en Excel y papeles pendientes de mandar a la gestoría.
                Y cada trimestre, a buscarlo todo otra vez.
              </p>
            </div>
            <div className="lp-reveal">
              <p className="lp-mono mb-4 text-[12px] text-lp-dim">Con Archivum</p>
              <table className="w-full border-t border-lp-ink text-[13.5px]">
                <tbody>
                  {ORDERED.map(([num, who, amount, status]) => (
                    <tr key={num} className="border-b border-lp-rule">
                      <td className="lp-mono py-3.5 pr-3 text-[12.5px]">{num}</td>
                      <td className="hidden py-3.5 pr-3 text-lp-dim sm:table-cell">{who}</td>
                      <td className="lp-mono py-3.5 pr-3 text-right">{amount}</td>
                      <td className="py-3.5 text-right text-[12.5px] text-lp-accent">{status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-9 max-w-[42ch] text-[15px] leading-[1.7]">
                Cada documento con su número, su cliente y su estado. El pedido, el albarán y la
                factura de una misma operación, enlazados entre sí.
              </p>
            </div>
          </div>
        </Section>

        {/* ── 02 · Funciones (índice) ────────────────────────────────────── */}
        <Section id="funciones" n="02" label="Lo que hace">
          <h2 className="lp-reveal lp-serif max-w-[20ch] text-[2.3rem] leading-[1.04] tracking-[-0.03em] sm:text-[3.4rem]">
            Menos herramientas sueltas. Menos tiempo en papeleo.
          </h2>
          <ol className="mt-14 border-t border-lp-ink">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className="lp-reveal group grid items-baseline gap-x-8 gap-y-2 border-b border-lp-rule py-7 transition-colors duration-500 ease-lp hover:bg-lp-sheet/70 sm:grid-cols-[3rem_minmax(0,15rem)_1fr] sm:px-3 xl:grid-cols-[3rem_minmax(0,17rem)_1fr_auto]"
              >
                <span className="lp-mono text-[12px] text-lp-dim">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="lp-serif text-[1.7rem] leading-tight tracking-[-0.02em] transition-transform duration-500 ease-lp group-hover:translate-x-1.5 sm:text-[1.9rem]">
                  {f.title}
                </h3>
                <p className="max-w-[52ch] text-[15px] leading-[1.7] text-lp-dim">{f.desc}</p>
                <span className="lp-mono hidden text-right text-[12px] text-lp-accent xl:block">{f.detail}</span>
              </li>
            ))}
          </ol>
          <p className="lp-reveal mt-8 max-w-[70ch] text-[14px] leading-[1.7] text-lp-dim">
            Y además: alertas de vencimiento, búsqueda avanzada, importación de clientes y productos
            desde Excel, envío de facturas por correo y la interfaz en español o en inglés.
          </p>
        </Section>

        {/* ── 03 · VeriFactu ─────────────────────────────────────────────── */}
        <Section id="verifactu" n="03" label="VERI*FACTU" band>
          <div className="grid gap-x-14 gap-y-14 xl:grid-cols-[1fr_1.05fr]">
            <div className="lp-reveal">
              <h2 className="lp-serif text-[2.3rem] leading-[1.04] tracking-[-0.03em] sm:text-[3.4rem]">
                Cada factura lleva la huella de la anterior.
              </h2>
              <p className="mt-7 max-w-[50ch] text-[16px] leading-[1.75] text-lp-dim">
                Archivum está preparado para VeriFactu: al emitir, genera el registro de la factura
                con su huella encadenada y el código QR de cotejo de la AEAT. Subes tu certificado
                digital una vez y el registro se prepara y se remite sin software aparte.
              </p>
              <ul className="mt-8 space-y-3 text-[15px]">
                {[
                  "Huella criptográfica encadenada entre facturas",
                  "Código QR de cotejo en la sede de la AEAT",
                  "Certificado digital cifrado por organización",
                  "Rectificativas y anulaciones con su propio registro",
                ].map(t => (
                  <li key={t} className="flex gap-3"><Tick />{t}</li>
                ))}
              </ul>
              <div className="mt-9">
                <TextLink href="/declaracion-responsable">Declaración responsable del sistema</TextLink>
              </div>
            </div>

            {/* La cadena: la huella de cada registro es la «anterior» del siguiente */}
            <div className="lp-reveal self-center" aria-hidden="true">
              <div className="lp-mono text-[12px]">
                <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 border-b border-lp-ink pb-3 text-lp-dim">
                  <span>Registro</span><span>Huella anterior</span><span>Huella</span>
                </div>
                {CHAIN_RECORDS.map((r, i) => (
                  <div key={r.num} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-4 border-b border-lp-rule py-5">
                    <span className="text-lp-ink">{r.num}</span>
                    <span className={i === 0 ? "text-lp-dim" : "text-lp-accent"}>{r.prev}</span>
                    <span className={`${i === CHAIN_RECORDS.length - 1 ? "text-lp-ink" : "text-lp-accent"}`}>
                      {r.hash}
                      {i < CHAIN_RECORDS.length - 1 && <span className="ml-2 text-lp-dim">↲</span>}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-5 max-w-[46ch] text-[13px] leading-[1.65] text-lp-dim">
                Si alguien altera una factura ya emitida, su huella deja de coincidir con la que
                guarda la siguiente. Así cualquier cambio queda a la vista.
              </p>
            </div>
          </div>
        </Section>

        {/* ── 04 · Del pedido al cobro ───────────────────────────────────── */}
        <Section id="flujo-documental" n="04" label="Del pedido al cobro">
          <h2 className="lp-reveal lp-serif max-w-[17ch] text-[2.3rem] leading-[1.04] tracking-[-0.03em] sm:text-[3.4rem]">
            Cada documento, conectado con su origen.
          </h2>
          <ol className="lp-reveal mt-16 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((s, i) => (
              <li key={s.title} className="relative pr-8">
                <div className="flex items-center">
                  <span className={`lp-mono flex h-11 min-w-11 items-center justify-center rounded-full border px-2 text-[12px] ${i === 2 ? "border-lp-accent bg-lp-accent text-lp-paper" : "border-lp-ink text-lp-ink"}`}>
                    {s.code}
                  </span>
                  {i < FLOW.length - 1 && <span className="ml-3 hidden h-px flex-1 bg-lp-ink sm:block" />}
                </div>
                <h3 className="lp-serif mt-6 text-[1.7rem] tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 max-w-[26ch] text-[14.5px] leading-[1.65] text-lp-dim">{s.desc}</p>
              </li>
            ))}
          </ol>
          <p className="lp-reveal mt-14 max-w-[58ch] text-[15px] leading-[1.7] text-lp-dim">
            Desde cualquiera de ellos ves la cadena completa. Y una factura emitida ya no se
            modifica: si hay un error, se rectifica con otra.
          </p>
        </Section>

        {/* ── 05 · Tu gestoría ───────────────────────────────────────────── */}
        <Section id="gestoria" n="05" label="Tu gestoría">
          <div className="grid gap-x-14 gap-y-12 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="lp-reveal">
              <h2 className="lp-serif text-[2.3rem] leading-[1.04] tracking-[-0.03em] sm:text-[3.4rem]">
                Deja de preparar el trimestre.
              </h2>
              <p className="mt-7 max-w-[44ch] text-[16px] leading-[1.75] text-lp-dim">
                Tu gestor entra con su propio usuario y encuentra las facturas emitidas y las
                recibidas ya ordenadas. Tú decides qué carpetas ve.
              </p>
            </div>
            <dl className="lp-reveal self-end border-t border-lp-ink">
              {ROLES.map(r => (
                <div key={r.role} className="grid gap-x-6 gap-y-1 border-b border-lp-rule py-6 sm:grid-cols-[11rem_1fr]">
                  <dt>
                    <span className="lp-serif block text-[1.4rem] tracking-[-0.02em]">{r.who}</span>
                    <span className="lp-mono text-[11.5px] text-lp-dim">{r.role}</span>
                  </dt>
                  <dd className="max-w-[46ch] text-[15px] leading-[1.7] text-lp-dim sm:pt-1.5">{r.can}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>

        {/* ── 06 · Planes ────────────────────────────────────────────────── */}
        <Section id="planes" n="06" label="Planes" band>
          <h2 className="lp-reveal lp-serif max-w-[16ch] text-[2.3rem] leading-[1.04] tracking-[-0.03em] sm:text-[3.4rem]">
            Empieza gratis. Amplía cuando te haga falta.
          </h2>
          <p className="lp-reveal mt-6 max-w-[56ch] text-[16px] leading-[1.75] text-lp-dim">
            Los documentos que no gastas un mes se acumulan para el siguiente. Sin permanencia.
          </p>

          {/* Tabla comparativa (escritorio) */}
          <div className="lp-reveal mt-14 hidden md:block">
            <table className="w-full table-fixed border-collapse text-[14.5px]">
              <thead>
                <tr>
                  <th className="w-[21%]" />
                  {plans.map(p => (
                    <th key={p.id} className={`px-5 pb-6 pt-6 text-left align-bottom font-normal ${p.highlight ? "rounded-t-[6px] bg-lp-sheet" : ""}`}>
                      {p.highlight && <span className="lp-mono mb-3 block text-[11px] text-lp-accent">Recomendado</span>}
                      <span className="lp-serif block text-[1.7rem] tracking-[-0.02em]">{p.name}</span>
                      <span className="lp-mono mt-3 block text-[1.55rem] tracking-[-0.03em] text-lp-ink">{p.priceLabel}</span>
                      <span className="lp-mono mt-1 block text-[11.5px] text-lp-dim">{p.priceSuffix}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="lp-mono">
                {([
                  ["Usuarios incluidos", p => String(p.users)],
                  ["Documentos al mes", p => fmt(p.docsPerMonth)],
                  ["Documentos al año", p => fmt(p.docsPerYear)],
                  ["Almacenamiento", p => `${fmt(p.storageGB)} GB`],
                ] as [string, (p: (typeof plans)[number]) => string][]).map(([label, get]) => (
                  <tr key={label} className="border-t border-lp-rule">
                    <th scope="row" className="py-4 pr-4 text-left font-sans text-[14px] font-normal text-lp-dim" style={{ fontFamily: "var(--font-lp-sans)" }}>{label}</th>
                    {plans.map(p => (
                      <td key={p.id} className={`px-5 py-4 ${p.highlight ? "bg-lp-sheet" : ""}`}>{get(p)}</td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-lp-rule">
                  <td />
                  {plans.map(p => (
                    <td key={p.id} className={`px-5 pb-6 pt-6 align-top ${p.highlight ? "rounded-b-[6px] bg-lp-sheet" : ""}`}>
                      <Link
                        href="/auth/signup"
                        style={{ fontFamily: "var(--font-lp-sans)" }}
                        className={`block rounded-[5px] px-3 py-3 text-center text-[14px] font-medium transition-[background-color,color,transform] duration-300 ease-lp active:translate-y-px ${
                          p.highlight
                            ? "bg-lp-accent text-lp-paper hover:bg-lp-ink"
                            : "border border-lp-ink text-lp-ink hover:bg-lp-ink hover:text-lp-paper"
                        }`}
                      >
                        {p.price === 0 ? "Crear cuenta" : `Elegir ${p.name}`}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Lista (móvil) */}
          <div className="lp-reveal mt-12 border-t border-lp-ink md:hidden">
            {plans.map(p => (
              <div key={p.id} className={`border-b border-lp-rule py-7 ${p.highlight ? "-mx-5 bg-lp-sheet px-5" : ""}`}>
                {p.highlight && <p className="lp-mono mb-2 text-[11px] text-lp-accent">Recomendado</p>}
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="lp-serif text-[1.8rem] tracking-[-0.02em]">{p.name}</h3>
                  <p className="lp-mono text-right">
                    <span className="text-[1.3rem]">{p.priceLabel}</span>
                    <span className="block text-[11px] text-lp-dim">{p.priceSuffix}</span>
                  </p>
                </div>
                <p className="lp-mono mt-4 text-[12.5px] leading-[1.9] text-lp-dim">
                  {p.users} {p.users === 1 ? "usuario" : "usuarios"} · {fmt(p.docsPerMonth)} docs/mes · {fmt(p.docsPerYear)}/año · {fmt(p.storageGB)} GB
                </p>
                <Link
                  href="/auth/signup"
                  className={`mt-5 block rounded-[5px] py-3 text-center text-[14px] font-medium ${
                    p.highlight ? "bg-lp-accent text-lp-paper" : "border border-lp-ink text-lp-ink"
                  }`}
                >
                  {p.price === 0 ? "Crear cuenta" : `Elegir ${p.name}`}
                </Link>
              </div>
            ))}
          </div>

          <div className="lp-reveal mt-12 grid gap-x-14 gap-y-8 md:grid-cols-2">
            <div>
              <p className="lp-mono mb-3 text-[12px] text-lp-dim">Complementos, en los planes de pago</p>
              <dl className="border-t border-lp-rule text-[14.5px]">
                {Object.values(ADDONS).map(a => (
                  <div key={a.label} className="flex items-baseline justify-between gap-4 border-b border-lp-rule py-3.5">
                    <dt>{a.label}</dt>
                    <dd className="lp-mono whitespace-nowrap text-[13px]">{a.priceLabel}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="max-w-[46ch] self-end text-[13.5px] leading-[1.7] text-lp-dim">
              Precios mensuales sin IVA (21 %). Siempre se empieza con la cuenta gratuita; el plan
              se contrata desde dentro, cuando quieras.
            </p>
          </div>
        </Section>

        {/* ── 07 · Preguntas ─────────────────────────────────────────────── */}
        <Section id="preguntas" n="07" label="Preguntas">
          <h2 className="lp-reveal lp-serif max-w-[16ch] text-[2.3rem] leading-[1.04] tracking-[-0.03em] sm:text-[3.4rem]">
            Lo que conviene saber antes de empezar.
          </h2>
          <dl className="mt-14 grid gap-x-14 border-t border-lp-ink md:grid-cols-2">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="lp-reveal border-b border-lp-rule py-7">
                <dt className="lp-serif text-[1.3rem] leading-snug tracking-[-0.015em]">{q}</dt>
                <dd className="mt-3 max-w-[52ch] text-[15px] leading-[1.7] text-lp-dim">{a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* ── Cierre ─────────────────────────────────────────────────────── */}
        <section className="border-t border-lp-ink bg-lp-ink text-lp-paper">
          <div className={`${WRAP} grid items-end gap-10 py-24 sm:py-32 lg:grid-cols-12`}>
            <h2 className="lp-reveal lp-serif text-[2.6rem] leading-[1] tracking-[-0.035em] sm:text-[4.4rem] lg:col-span-8">
              Empieza por la próxima factura. <em className="text-lp-paper/55">El resto se ordena solo.</em>
            </h2>
            <div className="lp-reveal lg:col-span-4 lg:justify-self-end">
              <Button href="/auth/signup" tone="accent">Crear cuenta gratis</Button>
              <p className="lp-mono mt-5 text-[12px] text-lp-paper/55">
                ¿Ya tienes cuenta?{" "}
                <Link href="/auth/login" className="text-lp-paper underline underline-offset-4">Entrar</Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Pie ──────────────────────────────────────────────────────────── */}
      <footer className="bg-lp-paper">
        <div className={`${WRAP} flex flex-col justify-between gap-8 py-10 text-[13px] text-lp-dim lg:flex-row lg:items-end`}>
          <div>
            <Logo size={26} textClassName="lp-serif text-lp-ink text-xl tracking-[-0.02em]" />
            <p className="mt-3">Una gestión más sencilla para pequeños negocios.</p>
          </div>
          <nav aria-label="Enlaces legales" className="flex flex-wrap gap-x-6 gap-y-2">
            {/* LSSI art. 10: el aviso legal tiene que estar a un clic desde la web. */}
            <Link href="/terminos" className="hover:text-lp-ink">Aviso legal</Link>
            <Link href="/privacidad" className="hover:text-lp-ink">Privacidad</Link>
            <Link href="/cookies" className="hover:text-lp-ink">Cookies</Link>
            {/* Art. 13.2: available to the client at the moment of acquisition,
                which means reachable without an account. */}
            <Link href="/declaracion-responsable" className="hover:text-lp-ink">Declaración responsable</Link>
            <Link href="/auth/login" className="hover:text-lp-ink">Iniciar sesión</Link>
            <Link href="/auth/signup" className="hover:text-lp-ink">Registro</Link>
          </nav>
        </div>
        <div className={`${WRAP} flex flex-col items-start justify-between gap-3 border-t border-lp-rule py-5 text-xs text-lp-dim sm:flex-row sm:items-center`}>
          <p>© {new Date().getFullYear()} Archivum. Todos los derechos reservados.</p>
          {/* Crédito del estudio que diseñó la web (enlace con UTM para medir las visitas que llegan desde aquí) */}
          <LumenCredit />
        </div>
      </footer>
    </div>
  )
}
