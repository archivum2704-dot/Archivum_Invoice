"use client"

import { useState } from "react"
import {
  FileText,
  Receipt,
  Package,
  FolderOpen,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"

const stats = [
  { label: "Total Documentos", value: "1.284", delta: "+48 este mes", icon: FolderOpen, color: "text-primary" },
  { label: "Facturas", value: "643", delta: "+21 este mes", icon: FileText, color: "text-accent" },
  { label: "Albaranes", value: "312", delta: "+12 este mes", icon: Package, color: "text-[var(--status-paid)]" },
  { label: "Recibos", value: "329", delta: "+15 este mes", icon: Receipt, color: "text-[var(--status-pending)]" },
]

const recentDocs = [
  { id: "FAC-2024-0892", empresa: "Construcciones García SL", tipo: "Factura", importe: "4.250,00 €", fecha: "14 mar 2024", estado: "Pagada" },
  { id: "ALB-2024-0341", empresa: "Distribuciones Norte SA", tipo: "Albarán", importe: "1.800,00 €", fecha: "13 mar 2024", estado: "Pendiente" },
  { id: "FAC-2024-0891", empresa: "Servicios Tech SL", tipo: "Factura", importe: "9.600,00 €", fecha: "12 mar 2024", estado: "Pagada" },
  { id: "REC-2024-0128", empresa: "Transportes Iberia SA", tipo: "Recibo", importe: "540,00 €", fecha: "11 mar 2024", estado: "Pagada" },
  { id: "FAC-2024-0890", empresa: "Suministros del Sur SL", tipo: "Factura", importe: "2.150,00 €", fecha: "10 mar 2024", estado: "Vencida" },
  { id: "ALB-2024-0340", empresa: "Logística Peninsular SA", tipo: "Albarán", importe: "3.200,00 €", fecha: "09 mar 2024", estado: "Pendiente" },
]

const estadoConfig: Record<string, { label: string; className: string }> = {
  Pagada: { label: "Pagada", className: "bg-[var(--status-paid)]/10 text-[var(--status-paid)]" },
  Pendiente: { label: "Pendiente", className: "bg-[var(--status-pending)]/10 text-[var(--status-pending)]" },
  Vencida: { label: "Vencida", className: "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]" },
}

const tipoConfig: Record<string, string> = {
  Factura: "bg-accent/10 text-accent",
  Albarán: "bg-primary/10 text-primary",
  Recibo: "bg-secondary-foreground/10 text-muted-foreground",
}

const monthlyData = [
  { mes: "Oct", docs: 94 },
  { mes: "Nov", docs: 108 },
  { mes: "Dic", docs: 87 },
  { mes: "Ene", docs: 121 },
  { mes: "Feb", docs: 134 },
  { mes: "Mar", docs: 48 },
]

const maxDocs = Math.max(...monthlyData.map((d) => d.docs))

export function DashboardView() {
  const [searchQuery, setSearchQuery] = useState("")
  const { currentOrg, loading: orgLoading } = useOrganization()
  const { documents, loading: docsLoading } = useDocuments(currentOrg?.id || null)
  
  const loading = orgLoading || docsLoading

  // Calculate stats from real data
  const stats = loading ? [] : [
    { label: "Total Documentos", value: documents.length.toString(), delta: "de este período", icon: FolderOpen, color: "text-primary" },
    { label: "Facturas", value: documents.filter(d => d.document_type === 'invoice').length.toString(), delta: "este período", icon: FileText, color: "text-accent" },
    { label: "Reportes", value: documents.filter(d => d.document_type === 'report').length.toString(), delta: "este período", icon: Package, color: "text-[var(--status-paid)]" },
    { label: "Recibos", value: documents.filter(d => d.document_type === 'receipt').length.toString(), delta: "este período", icon: Receipt, color: "text-[var(--status-pending)]" },
  ]

  const recentDocs = documents.slice(0, 6).map(doc => ({
    id: doc.document_number,
    empresa: "Empresa", // Will be joined from companies table in full implementation
    tipo: doc.document_type,
    importe: `${doc.total_amount.toFixed(2)} €`,
    fecha: new Date(doc.date).toLocaleDateString('es-ES'),
    estado: doc.status,
  }))

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">Panel Principal</h1>
          <p className="text-muted-foreground text-sm mt-1">Lunes, 14 de marzo de 2024</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          <Link
            href="/subir"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Documento
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{stat.label}</span>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-muted", stat.color.replace("text-", "bg-") + "/10")}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-[var(--status-paid)]" />
                {stat.delta}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Documents Table */}
        <div className="col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Documentos Recientes</h2>
            <Link href="/biblioteca" className="text-xs text-accent hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentDocs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors group cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{doc.empresa}</p>
                  <p className="text-xs text-muted-foreground">{doc.id}</p>
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tipoConfig[doc.tipo])}>{doc.tipo}</span>
                <span className="text-sm font-semibold text-foreground w-28 text-right">{doc.importe}</span>
                <span className="text-xs text-muted-foreground w-24 text-right">{doc.fecha}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium w-20 text-center", estadoConfig[doc.estado].className)}>
                  {estadoConfig[doc.estado].label}
                </span>
                <MoreHorizontal className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Activity Chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground text-sm">Actividad Mensual</h2>
              <span className="text-xs text-muted-foreground">últimos 6 meses</span>
            </div>
            <div className="flex items-end gap-2 h-28">
              {monthlyData.map((d) => (
                <div key={d.mes} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/20 hover:bg-primary/40 transition-colors relative group"
                    style={{ height: `${(d.docs / maxDocs) * 100}%` }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {d.docs} docs
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{d.mes}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Estado summary */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground text-sm mb-4">Estado de Facturas</h2>
            <div className="space-y-3">
              {[
                { label: "Pagadas", count: 421, pct: 65, icon: CheckCircle2, color: "text-[var(--status-paid)]", bar: "bg-[var(--status-paid)]" },
                { label: "Pendientes", count: 156, pct: 24, icon: Clock, color: "text-[var(--status-pending)]", bar: "bg-[var(--status-pending)]" },
                { label: "Vencidas", count: 66, pct: 11, icon: AlertCircle, color: "text-[var(--status-overdue)]", bar: "bg-[var(--status-overdue)]" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <item.icon className={cn("w-3.5 h-3.5", item.color)} />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{item.count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", item.bar)} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground text-sm mb-3">Accesos Rápidos</h2>
            <div className="space-y-1">
              {[
                { label: "Facturas de hoy", href: "/biblioteca?tipo=factura&fecha=hoy" },
                { label: "Pendientes de pago", href: "/biblioteca?estado=pendiente" },
                { label: "Empresas activas", href: "/empresas" },
                { label: "Búsqueda avanzada", href: "/buscador" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/60 text-sm text-foreground transition-colors"
                >
                  {link.label}
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </>
      )}
    </div>
  )
}
