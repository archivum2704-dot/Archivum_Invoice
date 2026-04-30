"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  FileText, Package, Receipt, FolderOpen,
  ArrowRight, CheckCircle2, Bell, BarChart3,
  Link2, Shield, Globe, Zap,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Logo } from "@/components/logo"

const FEATURES = [
  {
    icon: FolderOpen,
    title: "Archivo centralizado",
    desc: "Facturas, albaranes, pedidos y recibos en un único lugar. Con búsqueda, filtros y exportación a Excel.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Link2,
    title: "Workflow Orden → Albarán → Factura",
    desc: "Crea albaranes desde pedidos y facturas desde albaranes en un clic. La cadena documental siempre visible.",
    color: "bg-accent/10 text-accent",
  },
  {
    icon: Bell,
    title: "Alertas de vencimiento",
    desc: "Badge rojo en tiempo real cuando hay facturas vencidas. Sin sorpresas al cierre de mes.",
    color: "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
  },
  {
    icon: BarChart3,
    title: "Métricas en el dashboard",
    desc: "Gráfico de actividad mensual, estado de cobros y accesos rápidos a lo que más usas.",
    color: "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  },
]

const WORKFLOW_STEPS = [
  { icon: FolderOpen, label: "Pedido",          sub: "Origen del proceso",       color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { icon: Package,    label: "Albarán",          sub: "Confirmación de entrega",  color: "bg-primary/10 text-primary" },
  { icon: FileText,   label: "Factura emitida",  sub: "Cobro del servicio",       color: "bg-accent/10 text-accent" },
  { icon: Receipt,    label: "Recibo",           sub: "Pago confirmado",          color: "bg-[var(--status-paid)]/10 text-[var(--status-paid)]" },
]

const SOCIAL_PROOF = [
  "Sin tarjeta de crédito",
  "Datos en Europa (EU)",
  "Exportación CSV y Excel",
  "Multi-empresa",
]

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

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo size={32} textClassName="text-foreground text-sm" />
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Iniciar sesión
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
          <Zap className="w-3 h-3" />
          Gestión documental para pymes y autónomos
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-foreground mb-5 max-w-3xl mx-auto leading-tight">
          El archivo de tu empresa.{" "}
          <span className="text-primary">Ordenado y siempre a mano.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
          Archiva facturas, albaranes y pedidos. Gestiona el flujo completo Orden → Albarán → Factura
          y recibe alertas cuando se acercan los vencimientos.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/auth/signup"
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Crear cuenta gratis <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-card border border-border text-foreground font-medium rounded-xl hover:bg-muted transition-colors text-sm"
          >
            Ya tengo cuenta
          </Link>
        </div>
        <div className="flex items-center justify-center gap-5 mt-6 flex-wrap">
          {SOCIAL_PROOF.map(s => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-paid)]" />
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">
          Todo lo que necesitas para gestionar tu documentación
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.color}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Workflow visual ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-border">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Flujo de trabajo</p>
            <h2 className="text-3xl font-bold text-foreground mb-4 leading-tight">
              Conecta cada documento<br />con su origen
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Desde un pedido puedes generar el albarán en un clic. Desde el albarán, la factura.
              La cadena completa siempre visible en el lateral del documento.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Probarlo gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 space-y-2">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.label}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${step.color}`}>
                    <step.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.sub}</p>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-paid)] shrink-0" />
                  )}
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="ml-[22px] w-px h-3 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ──────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-border">
        <div className="grid grid-cols-3 gap-6 text-center">
          {[
            { icon: Shield, title: "Datos seguros", desc: "Alojado en Europa. RLS por organización. Nadie accede a tus documentos." },
            { icon: Globe,  title: "ES / EN", desc: "Interfaz disponible en español e inglés. Cambia de idioma en cualquier momento." },
            { icon: Zap,    title: "Sin instalación", desc: "100% en el navegador. Nada que instalar, nada que mantener." },
          ].map(item => (
            <div key={item.title} className="flex flex-col items-center gap-3 p-5">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <item.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Final ──────────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Empieza a ordenar tu documentación hoy
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Crea tu cuenta en menos de un minuto. Sin tarjeta de crédito.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            Crear cuenta gratis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <Logo size={24} textClassName="text-muted-foreground text-xs" />
          <p>© {new Date().getFullYear()} Archivum. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/auth/login" className="hover:text-foreground transition-colors">Iniciar sesión</Link>
            <Link href="/auth/signup" className="hover:text-foreground transition-colors">Registro</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
