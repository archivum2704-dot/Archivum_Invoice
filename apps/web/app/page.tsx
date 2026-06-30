"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  FileText, Package, Receipt, FolderOpen,
  ArrowRight, CheckCircle2, Bell, BarChart3,
  Shield, Globe, Zap, Search, Download,
  ChevronRight, Star, ShieldCheck, Building2, Users, QrCode,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Logo } from "@/components/logo"
import { PLANS, ADDONS, PRICING_FAQ } from "@/lib/pricing"

const SOCIAL_PROOF = [
  "Plan gratuito incluido",
  "Conforme con VeriFactu",
  "Datos en Europa (EU)",
  "Multi-empresa",
]

const STATS = [
  { value: "VeriFactu", label: "Conforme con la AEAT" },
  { value: "0 €", label: "Para empezar" },
  { value: "IVA + IRPF", label: "Calculados al instante" },
  { value: "100%", label: "En la nube" },
]

// Primary feature cards
const FEATURES = [
  {
    icon: Receipt,
    title: "Emisión de facturas",
    desc: "Crea facturas con líneas de producto, IVA e IRPF calculados automáticamente, numeración correlativa y PDF profesional.",
    color: "bg-primary/10 text-primary",
    border: "border-primary/20",
  },
  {
    icon: ShieldCheck,
    title: "Conforme con VeriFactu",
    desc: "Facturas con huella encadenada y QR de cotejo de la AEAT. Cumple con el nuevo sistema de facturación verificable.",
    color: "bg-emerald-500/10 text-emerald-600",
    border: "border-emerald-500/20",
  },
  {
    icon: Package,
    title: "Inventario y catálogo",
    desc: "Gestiona productos y servicios por categorías. Añádelos a tus facturas en un clic, sin reescribir precios ni impuestos.",
    color: "bg-violet-500/10 text-violet-600",
    border: "border-violet-500/20",
  },
  {
    icon: FolderOpen,
    title: "Archivo centralizado",
    desc: "Facturas, albaranes, pedidos y recibos en un único lugar. Con búsqueda avanzada, filtros y exportación a CSV/Excel.",
    color: "bg-blue-500/10 text-blue-600",
    border: "border-blue-500/20",
  },
  {
    icon: Building2,
    title: "Clientes y empresas",
    desc: "Tu cartera de clientes con sus datos fiscales siempre a mano. Reutilízalos al facturar y trabaja con varias empresas.",
    color: "bg-amber-500/10 text-amber-600",
    border: "border-amber-500/20",
  },
  {
    icon: Users,
    title: "Equipo con roles",
    desc: "Invita a tu equipo y controla los permisos. El administrador decide qué carpetas ve y descarga cada gestor.",
    color: "bg-rose-500/10 text-rose-600",
    border: "border-rose-500/20",
  },
]

// Secondary "y además" strip
const EXTRAS = [
  { icon: Bell,      label: "Alertas de vencimiento" },
  { icon: BarChart3, label: "Métricas financieras" },
  { icon: Search,    label: "Búsqueda avanzada" },
  { icon: Download,  label: "Exportación CSV/Excel" },
]

// Mock dashboard preview
function DashboardPreview() {
  return (
    <div className="relative w-full rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/50">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <div className="flex-1 mx-4">
          <div className="h-5 bg-muted rounded-md w-48 mx-auto flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">archivum2704-dot.vercel.app</span>
          </div>
        </div>
      </div>

      <div className="flex h-[340px] sm:h-[400px]">
        {/* Sidebar mock */}
        <div className="w-44 shrink-0 border-r border-border bg-sidebar p-3 hidden sm:flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-primary/20" />
            <div className="h-3 bg-sidebar-foreground/20 rounded w-16" />
          </div>
          {["Panel","Empresas","Biblioteca","Inventario","Facturación","Subir"].map((item, i) => (
            <div key={item} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${i === 0 ? "bg-sidebar-primary/20" : ""}`}>
              <div className="w-3.5 h-3.5 rounded bg-sidebar-foreground/20 shrink-0" />
              <span className="text-[11px] text-sidebar-foreground/60">{item}</span>
            </div>
          ))}
        </div>

        {/* Main content mock */}
        <div className="flex-1 p-4 overflow-hidden bg-background">
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { label: "Documentos", val: "128", color: "bg-primary/10" },
              { label: "Cobrado", val: "24.800 €", color: "bg-emerald-500/10" },
              { label: "Pendiente", val: "6.240 €", color: "bg-amber-500/10" },
              { label: "Vencido", val: "1.200 €", color: "bg-red-500/10" },
            ].map(kpi => (
              <div key={kpi.label} className={`${kpi.color} rounded-xl p-3`}>
                <p className="text-[9px] text-muted-foreground mb-1">{kpi.label}</p>
                <p className="text-xs font-bold text-foreground">{kpi.val}</p>
              </div>
            ))}
          </div>

          {/* Recent docs list */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-[10px] font-semibold text-foreground">Documentos recientes</p>
              <span className="flex items-center gap-1 text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                <QrCode className="w-2.5 h-2.5" /> VeriFactu
              </span>
            </div>
            {[
              { num: "FAC-2024-089", co: "Construcciones García", amt: "3.420 €", status: "Pagada", sc: "bg-emerald-100 text-emerald-700" },
              { num: "ALB-2024-034", co: "Suministros López", amt: "840 €", status: "Pendiente", sc: "bg-amber-100 text-amber-700" },
              { num: "PED-2024-021", co: "Reformas Martínez", amt: "12.000 €", status: "Borrador", sc: "bg-muted text-muted-foreground" },
              { num: "FAC-2024-088", co: "Tech Solutions SL", amt: "2.100 €", status: "Vencida", sc: "bg-red-100 text-red-700" },
            ].map(doc => (
              <div key={doc.num} className="flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-0">
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-foreground truncate">{doc.num}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{doc.co}</p>
                </div>
                <p className="text-[10px] font-semibold text-foreground shrink-0">{doc.amt}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${doc.sc}`}>{doc.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard")
      else setChecking(false)
    })
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo size={32} textClassName="text-foreground text-sm" />
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/auth/signup"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Empezar gratis <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 border border-primary/20">
            <Zap className="w-3 h-3" />
            Facturación y gestión documental para pymes y autónomos
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-5 max-w-4xl mx-auto leading-tight">
            Emite y archiva tus facturas.{" "}
            <span className="text-primary relative">
              Conforme con VeriFactu.
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            Crea facturas con IVA e IRPF, gestiona clientes y productos, y
            archiva todo tu flujo Pedido → Albarán → Factura. Con alertas de
            vencimiento y métricas en tiempo real.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href="/auth/signup"
              className="flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Crear cuenta gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="px-7 py-3 bg-card border border-border text-foreground font-medium rounded-xl hover:bg-muted transition-colors"
            >
              Ya tengo cuenta
            </Link>
          </div>

          <div className="flex items-center justify-center gap-5 flex-wrap mb-16">
            {SOCIAL_PROOF.map(s => (
              <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {s}
              </span>
            ))}
          </div>

          {/* Product preview */}
          <div className="max-w-4xl mx-auto">
            <DashboardPreview />
            {/* Fade bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map(s => (
              <div key={s.label}>
                <p className="text-2xl sm:text-3xl font-bold text-primary mb-1">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Funcionalidades</p>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Factura, controla y archiva. Todo en un sitio.
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Diseñado para autónomos y pymes que quieren facturar bien y mantener
            el orden sin complejidad.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className={`bg-card border ${f.border} rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-shadow`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.color}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1.5">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Extras strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Y además</span>
          {EXTRAS.map(e => (
            <span key={e.label} className="inline-flex items-center gap-1.5 text-xs text-foreground bg-card border border-border rounded-full px-3 py-1.5">
              <e.icon className="w-3.5 h-3.5 text-primary" />
              {e.label}
            </span>
          ))}
        </div>
      </section>

      {/* ── VeriFactu highlight ──────────────────────────────────────────── */}
      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground text-xs font-medium mb-5 border border-primary-foreground/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Cumplimiento normativo
              </span>
              <h2 className="text-3xl font-bold mb-4 leading-tight">
                Facturas listas para la era VeriFactu
              </h2>
              <p className="text-primary-foreground/80 leading-relaxed mb-6">
                Cada factura emitida incorpora la huella encadenada y el código QR
                de cotejo de la AEAT. Sube tu certificado digital una vez y factura
                conforme al sistema de facturación verificable, sin software extra.
              </p>
              <ul className="space-y-2.5">
                {[
                  "Huella criptográfica encadenada entre facturas",
                  "QR de cotejo verificable en la Sede de la AEAT",
                  "Certificado digital cifrado por organización",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-primary-foreground/90">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mock verifactu invoice corner */}
            <div className="bg-card text-foreground rounded-2xl border border-border p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Factura</p>
                  <p className="text-lg font-bold">FAC-2026-014</p>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="w-3 h-3" /> VeriFactu
                </span>
              </div>
              <div className="space-y-2 mb-4">
                {[
                  { d: "Base imponible", v: "1.000,00 €" },
                  { d: "IVA (21%)", v: "210,00 €" },
                  { d: "IRPF (-15%)", v: "-150,00 €" },
                ].map(row => (
                  <div key={row.d} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{row.d}</span>
                    <span className="font-medium text-foreground">{row.v}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-border text-sm font-bold">
                  <span>Total</span>
                  <span>1.060,00 €</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-3">
                <div className="w-12 h-12 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                  <QrCode className="w-7 h-7 text-foreground" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Factura verificable en la Sede electrónica de la AEAT mediante
                  el código QR.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/20">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Flujo de trabajo</p>
              <h2 className="text-3xl font-bold text-foreground mb-4 leading-tight">
                Conecta cada documento<br />con su origen
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Desde un pedido puedes generar el albarán en un clic. Desde el albarán, la factura.
                La cadena completa siempre visible. Sin duplicar datos.
              </p>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Probarlo gratis <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 space-y-1.5">
              {[
                { icon: FolderOpen, label: "Pedido",         sub: "Origen del proceso",      color: "bg-blue-100 text-blue-600",     done: true },
                { icon: Package,   label: "Albarán",         sub: "Confirmación de entrega", color: "bg-primary/10 text-primary",    done: true },
                { icon: FileText,  label: "Factura emitida", sub: "Conforme con VeriFactu",  color: "bg-violet-100 text-violet-600", done: false },
                { icon: Receipt,   label: "Recibo",          sub: "Pago confirmado",         color: "bg-emerald-100 text-emerald-600", done: false },
              ].map((step, i) => (
                <div key={step.label}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${step.color}`}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.sub}</p>
                    </div>
                    {step.done
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    }
                  </div>
                  {i < 3 && <div className="ml-[22px] w-px h-3 bg-border" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: Shield, title: "Datos seguros", desc: "Alojado en Europa. RLS por organización. Nadie accede a tus documentos." },
              { icon: Globe,  title: "ES / EN",        desc: "Interfaz disponible en español e inglés. Cambia de idioma en cualquier momento." },
              { icon: Zap,    title: "Sin instalación", desc: "100% en el navegador. Nada que instalar, nada que mantener." },
            ].map(item => (
              <div key={item.title} className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="border-t border-border" id="precios">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Precios</p>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Empieza gratis. Escala cuando lo necesites.
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              La cuota de documentos <strong>no consumida se acumula</strong> al mes siguiente.
              Sin letra pequeña. Cancela cuando quieras.
            </p>
          </div>

          {/* Plan cards — 4 columnas */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(PLANS).map(plan => (
              <div
                key={plan.id}
                className={`bg-card rounded-2xl overflow-hidden flex flex-col relative ${
                  plan.highlight
                    ? "border-2 border-primary shadow-lg shadow-primary/10"
                    : "border border-border"
                }`}
              >
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 bg-primary text-primary-foreground rounded-full">
                      <Star className="w-2.5 h-2.5" /> {plan.badge}
                    </span>
                  </div>
                )}
                <div className={`p-5 border-b border-border ${plan.highlight ? "bg-primary/5" : ""}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${plan.highlight ? "text-primary" : "text-muted-foreground"}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-3xl font-bold text-foreground">{plan.priceLabel}</span>
                    {plan.price > 0 && (
                      <span className="text-xs text-muted-foreground pb-1">{plan.priceSuffix}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                </div>

                <ul className="px-5 py-5 space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${plan.highlight ? "text-primary" : "text-emerald-500"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="px-5 pb-5">
                  <Link
                    href="/auth/signup"
                    className={`block w-full text-center px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
                        : "border border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {plan.price === 0 ? "Crear cuenta gratis" : "Empezar ahora"}
                  </Link>
                  {plan.price === 0 && (
                    <p className="text-center text-xs text-muted-foreground mt-2">Sin tarjeta · Para siempre</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="max-w-5xl mx-auto mt-8">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 text-center">
              Complementos disponibles en planes de pago
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {Object.values(ADDONS).map(addon => (
                <div key={addon.label} className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{addon.label}</p>
                    <p className="text-xs text-muted-foreground">{addon.sublabel}</p>
                  </div>
                  <span className="text-sm font-bold text-primary whitespace-nowrap">{addon.priceLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-5xl mx-auto mt-10 grid sm:grid-cols-2 gap-4">
            {PRICING_FAQ.map(({ q, a }) => (
              <div key={q} className="bg-muted/40 border border-border rounded-xl p-4">
                <p className="text-sm font-semibold text-foreground mb-1.5">{q}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-primary/5">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Empieza a facturar y ordenar hoy
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Gratis para siempre · Starter 14,99 € · Business 19,99 € · Pro 24,99 €/mes. Sin permanencia.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Crear cuenta gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-3.5 bg-card border border-border text-foreground font-medium rounded-xl hover:bg-muted transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <Logo size={24} textClassName="text-muted-foreground text-xs" />
          <p>© {new Date().getFullYear()} Archivum. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/auth/login"  className="hover:text-foreground transition-colors">Iniciar sesión</Link>
            <Link href="/auth/signup" className="hover:text-foreground transition-colors">Registro</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
