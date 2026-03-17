"use client"

import { useState } from "react"
import {
  FileText,
  Package,
  Receipt,
  FolderOpen,
  Search,
  Filter,
  Grid3X3,
  List,
  Plus,
  MoreHorizontal,
  Download,
  Eye,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"

const documentos = [
  { id: "FAC-2024-0892", empresa: "Construcciones García SL", tipo: "Factura", importe: "4.250,00 €", fecha: "14/03/2024", estado: "Pagada", etiquetas: ["Obra", "Madrid"] },
  { id: "ALB-2024-0341", empresa: "Distribuciones Norte SA", tipo: "Albarán", importe: "1.800,00 €", fecha: "13/03/2024", estado: "Pendiente", etiquetas: ["Stock"] },
  { id: "FAC-2024-0891", empresa: "Servicios Tech SL", tipo: "Factura", importe: "9.600,00 €", fecha: "12/03/2024", estado: "Pagada", etiquetas: ["Software", "Anual"] },
  { id: "REC-2024-0128", empresa: "Transportes Iberia SA", tipo: "Recibo", importe: "540,00 €", fecha: "11/03/2024", estado: "Pagada", etiquetas: ["Transporte"] },
  { id: "FAC-2024-0890", empresa: "Suministros del Sur SL", tipo: "Factura", importe: "2.150,00 €", fecha: "10/03/2024", estado: "Vencida", etiquetas: ["Material"] },
  { id: "ALB-2024-0340", empresa: "Logística Peninsular SA", tipo: "Albarán", importe: "3.200,00 €", fecha: "09/03/2024", estado: "Pendiente", etiquetas: ["Logística"] },
  { id: "FAC-2024-0889", empresa: "Construcciones García SL", tipo: "Factura", importe: "7.800,00 €", fecha: "08/03/2024", estado: "Pagada", etiquetas: ["Reforma"] },
  { id: "FAC-2024-0888", empresa: "Servicios Tech SL", tipo: "Factura", importe: "1.200,00 €", fecha: "07/03/2024", estado: "Pagada", etiquetas: ["Mantenimiento"] },
  { id: "REC-2024-0127", empresa: "Distribuciones Norte SA", tipo: "Recibo", importe: "890,00 €", fecha: "06/03/2024", estado: "Pendiente", etiquetas: ["Stock"] },
  { id: "ALB-2024-0339", empresa: "Transportes Iberia SA", tipo: "Albarán", importe: "2.100,00 €", fecha: "05/03/2024", estado: "Pagada", etiquetas: ["Transporte"] },
  { id: "FAC-2024-0887", empresa: "Suministros del Sur SL", tipo: "Factura", importe: "4.600,00 €", fecha: "04/03/2024", estado: "Pagada", etiquetas: ["Material", "Urgente"] },
  { id: "FAC-2024-0886", empresa: "Logística Peninsular SA", tipo: "Factura", importe: "6.300,00 €", fecha: "03/03/2024", estado: "Vencida", etiquetas: ["Logística"] },
]

const tipoConfig: Record<string, { icon: React.ElementType; className: string }> = {
  Factura: { icon: FileText, className: "bg-accent/10 text-accent" },
  Albarán: { icon: Package, className: "bg-primary/10 text-primary" },
  Recibo: { icon: Receipt, className: "bg-secondary-foreground/10 text-muted-foreground" },
}

const estadoConfig: Record<string, string> = {
  Pagada: "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  Pendiente: "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  Vencida: "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
}

const etiquetaColors = ["bg-blue-100 text-blue-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-rose-100 text-rose-700"]

export function BibliotecaView() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [search, setSearch] = useState("")
  const [filterTipo, setFilterTipo] = useState("Todos")
  const [filterEstado, setFilterEstado] = useState("Todos")

  const { currentOrg } = useOrganization()
  const { documents, loading } = useDocuments(currentOrg?.id || null)

  const mappedDocuments = documents.map(doc => ({
    id: doc.document_number,
    empresa: "Empresa Demo",
    tipo: doc.document_type === 'invoice' ? 'Factura' : doc.document_type === 'report' ? 'Albarán' : 'Recibo',
    importe: `${doc.total_amount.toFixed(2)} €`,
    fecha: new Date(doc.date).toLocaleDateString('es-ES'),
    estado: doc.status === 'paid' || doc.status === 'sent' ? 'Pagada' : doc.status === 'overdue' ? 'Vencida' : 'Pendiente',
    etiquetas: ["Demo"]
  }))

  const filtered = mappedDocuments.filter((d) => {
    const matchSearch =
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.empresa.toLowerCase().includes(search.toLowerCase())
    const matchTipo = filterTipo === "Todos" || d.tipo === filterTipo
    const matchEstado = filterEstado === "Todos" || d.estado === filterEstado
    return matchSearch && matchTipo && matchEstado
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">Biblioteca de Documentos</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} documentos encontrados</p>
        </div>
        <Link
          href="/subir"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Subir Documento
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por ID, empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtros:</span>
        </div>

        {/* Tipo filter */}
        <div className="relative">
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
          >
            {["Todos", "Factura", "Albarán", "Recibo"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Estado filter */}
        <div className="relative">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
          >
            {["Todos", "Pagada", "Pendiente", "Vencida"].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-card border border-border rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setViewMode("list")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn("p-1.5 rounded transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Cargando biblioteca...</p>
        </div>
      ) : (
        <>
          {/* List View */}
          {viewMode === "list" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1.5fr_auto] gap-4 px-5 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>Documento</span>
            <span>Empresa</span>
            <span>Tipo</span>
            <span>Importe</span>
            <span>Fecha</span>
            <span>Estado / Etiquetas</span>
            <span></span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((doc) => {
              const TipoIcon = tipoConfig[doc.tipo].icon
              return (
                <div
                  key={doc.id}
                  className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1.5fr_auto] gap-4 items-center px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <TipoIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <Link href={`/factura/${doc.id}`} className="text-sm font-medium text-foreground hover:text-accent truncate">
                      {doc.id}
                    </Link>
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{doc.empresa}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium inline-flex w-fit", tipoConfig[doc.tipo].className)}>{doc.tipo}</span>
                  <span className="text-sm font-semibold text-foreground">{doc.importe}</span>
                  <span className="text-sm text-muted-foreground">{doc.fecha}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", estadoConfig[doc.estado])}>{doc.estado}</span>
                    {doc.etiquetas.slice(0, 1).map((et, i) => (
                      <span key={et} className={cn("text-xs px-2 py-0.5 rounded-full", etiquetaColors[i % etiquetaColors.length])}>{et}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/factura/${doc.id}`} className="p-1.5 rounded hover:bg-muted transition-colors">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    </Link>
                    <button className="p-1.5 rounded hover:bg-muted transition-colors">
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-muted transition-colors">
                      <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-4 gap-4">
          {filtered.map((doc) => {
            const TipoIcon = tipoConfig[doc.tipo].icon
            return (
              <Link
                href={`/factura/${doc.id}`}
                key={doc.id}
                className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", estadoConfig[doc.estado])}>{doc.estado}</span>
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">{doc.id}</p>
                <p className="text-xs text-muted-foreground mb-3 truncate">{doc.empresa}</p>
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tipoConfig[doc.tipo].className)}>{doc.tipo}</span>
                  <span className="text-sm font-bold text-foreground">{doc.importe}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{doc.fecha}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {doc.etiquetas.map((et, i) => (
                    <span key={et} className={cn("text-xs px-1.5 py-0.5 rounded", etiquetaColors[i % etiquetaColors.length])}>{et}</span>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      </>
      )}
    </div>
  )
}
