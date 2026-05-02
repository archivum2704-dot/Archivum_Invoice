"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  FileText, Package, Receipt, FolderOpen,
  ArrowRight, CheckCircle2, Bell, BarChart3,
  Link2, Shield, Globe, Zap, Search, Download,
  TrendingUp, Clock, AlertCircle, ChevronRight,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Logo } from "@/components/logo"

const SOCIAL_PROOF = [
  "Sin tarjeta de crédito",
  "Datos en Europa (EU)",
  "Exportación CSV y Excel",
  "Multi-empresa",
]

const STATS = [
  { value: "100%", label: "En la nube" },
  { value: "0€", label: "Para empezar" },
  { value: "<1min", label: "Setup inicial" },
  { value: "∞", label: "Documentos" },
]

const FEATURES = [
  {
    icon: FolderOpen,
    title: "Archivo centralizado",
    desc: "Facturas, albaranes, pedidos y recibos en un único lugar. Con búsqueda avanzada, filtros y exportación.",
    color: "bg-primary/10 text-primary",
    border: "border-primary/20",
  },
  {
    icon: Link2,
    title: "Workflow completo",
    desc: "Crea albaranes desde pedidos y facturas desde albaranes en un clic. La cadena documental siempre visible.",
    color: "bg-violet-500/10 text-violet-600",
    border: "border-violet-500/20",
  },
  {
    icon: Bell,
    title: "Alertas de vencimiento",
    desc: "Badge rojo en tiempo real cuando hay facturas vencidas. Sin sorpresas al cierre de mes.",
    color: "bg-red-500/10 text-red-500",
    border: "border-red-500/20",
  },
  {
    icon: BarChart3,
    title: "Métricas financieras",
    desc: "KPIs de importes cobrados, pendientes y vencidos. Gráfico de actividad mensual en el dashboard.",
    color: "bg-emerald-500/10 text-emerald-600",
    border: "border-emerald-500/20",
  },
  {
    icon: Search,
    title: "Búsqueda potente",
    desc: "Filtra por tipo, estado, fecha e importe. Busca por número, empresa o notas. Exporta los resultados.",
    color: "bg-amber-500/10 text-amber-600",
    border: "border-amber-500/20",
  },
  {
    icon: Download,
    title: "Exportación total",
    desc: "Descarga cualquier lista en CSV o Excel con un clic. Compatible con contabilidad y hojas de cálculo.",
    color: "bg-blue-500/10 text-blue-600",
    border: "border-blue-500/20",
  },
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
          {["Dashboard","Biblioteca","Buscador","Subir","Empresas"].map((item, i) => (
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
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-[10px] font-semibold text-foreground">Documentos recientes</p>
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
            Gestión documental para pymes y autónomos
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-5 max-w-4xl mx-auto leading-tight">
            Tu archivo de facturas.{" "}
            <span className="text-primary relative">
              Ordenado y a mano.
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            Archiva facturas, albaranes y pedidos. Gestiona el flujo completo
            Pedido → Albarán → Factura y recibe alertas de vencimientos.
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
                <p className="text-3xl font-bold text-primary mb-1">{s.value}</p>
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
            Todo lo que necesitas, nada que no uses
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Diseñado para autónomos y pymes que quieren orden sin complejidad.
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
                { icon: FileText,  label: "Factura emitida", sub: "Cobro del servicio",      color: "bg-violet-100 text-violet-600", done: false },
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

      {/* ── CTA Final ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-primary/5">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Empieza a ordenar tu documentación hoy
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Crea tu cuenta en menos de un minuto. Sin tarjeta de crédito. Sin compromiso.
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
