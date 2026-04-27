"use client"

import { useState } from "react"
import {
  Search,
  SlidersHorizontal,
  FileText,
  Package,
  Receipt,
  CalendarDays,
  Building2,
  Tag,
  X,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"

const allDocuments = [
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
]

const tipoIcons: Record<string, React.ElementType> = {
  Factura: FileText,
  Albarán: Package,
  Recibo: Receipt,
}

const estadoConfig: Record<string, string> = {
  Pagada: "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  Pendiente: "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  Vencida: "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
}

const tipoConfig: Record<string, string> = {
  Factura: "bg-accent/10 text-accent",
  Albarán: "bg-primary/10 text-primary",
  Recibo: "bg-muted text-muted-foreground",
}

const allEtiquetas = ["Obra", "Madrid", "Stock", "Software", "Anual", "Transporte", "Material", "Reforma", "Mantenimiento", "Logística"]

export function BuscadorView() {
  const [query, setQuery] = useState("")
  const [selectedTipos, setSelectedTipos] = useState<string[]>([])
  const [selectedEstados, setSelectedEstados] = useState<string[]>([])
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([])
  const [selectedEtiquetas, setSelectedEtiquetas] = useState<string[]>([])
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")

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

  const empresas = Array.from(new Set(mappedDocuments.map((d) => d.empresa)))

  const toggleFilter = (arr: string[], setArr: (a: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])
  }

  const clearAll = () => {
    setQuery("")
    setSelectedTipos([])
    setSelectedEstados([])
    setSelectedEmpresas([])
    setSelectedEtiquetas([])
    setFechaDesde("")
    setFechaHasta("")
  }

  const activeFiltersCount = selectedTipos.length + selectedEstados.length + selectedEmpresas.length + selectedEtiquetas.length + (fechaDesde ? 1 : 0) + (fechaHasta ? 1 : 0)

  const results = mappedDocuments.filter((d) => {
    const matchQuery =
      !query ||
      d.id.toLowerCase().includes(query.toLowerCase()) ||
      d.empresa.toLowerCase().includes(query.toLowerCase())
    const matchTipo = !selectedTipos.length || selectedTipos.includes(d.tipo)
    const matchEstado = !selectedEstados.length || selectedEstados.includes(d.estado)
    const matchEmpresa = !selectedEmpresas.length || selectedEmpresas.includes(d.empresa)
    const matchEtiqueta = !selectedEtiquetas.length || selectedEtiquetas.some((et) => d.etiquetas.includes(et))
    return matchQuery && matchTipo && matchEstado && matchEmpresa && matchEtiqueta
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground text-balance">Buscador Avanzado</h1>
        <p className="text-muted-foreground text-sm mt-1">Encuentra cualquier documento con filtros precisos</p>
      </div>

      {/* Main search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Busca por número de documento, empresa, importe, CIF..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 text-base bg-card border-2 border-border rounded-xl focus:outline-none focus:border-accent placeholder:text-muted-foreground transition-colors"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className="w-60 shrink-0">
          <div className="bg-card border border-border rounded-xl p-4 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Filtros</span>
                {activeFiltersCount > 0 && (
                  <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full font-medium">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              {activeFiltersCount > 0 && (
                <button onClick={clearAll} className="text-xs text-accent hover:underline">Limpiar</button>
              )}
            </div>

            {/* Tipo */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</span>
              </div>
              <div className="space-y-1.5">
                {["Factura", "Albarán", "Recibo"].map((tipo) => (
                  <label key={tipo} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedTipos.includes(tipo)}
                      onChange={() => toggleFilter(selectedTipos, setSelectedTipos, tipo)}
                      className="w-3.5 h-3.5 rounded accent-accent"
                    />
                    <span className="text-sm text-foreground group-hover:text-accent transition-colors">{tipo}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Estado */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</span>
              </div>
              <div className="space-y-1.5">
                {["Pagada", "Pendiente", "Vencida"].map((est) => (
                  <label key={est} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedEstados.includes(est)}
                      onChange={() => toggleFilter(selectedEstados, setSelectedEstados, est)}
                      className="w-3.5 h-3.5 rounded accent-accent"
                    />
                    <span className="text-sm text-foreground group-hover:text-accent transition-colors">{est}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Fecha */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</span>
              </div>
              <div className="space-y-2">
                <input
                  type="date"
                  placeholder="Desde"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                />
                <input
                  type="date"
                  placeholder="Hasta"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                />
              </div>
            </div>

            {/* Empresa */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {empresas.map((emp) => (
                  <label key={emp} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedEmpresas.includes(emp)}
                      onChange={() => toggleFilter(selectedEmpresas, setSelectedEmpresas, emp)}
                      className="w-3.5 h-3.5 rounded accent-accent shrink-0"
                    />
                    <span className="text-xs text-foreground group-hover:text-accent transition-colors leading-relaxed">{emp}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Etiquetas */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Etiquetas</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allEtiquetas.map((et) => (
                  <button
                    key={et}
                    onClick={() => toggleFilter(selectedEtiquetas, setSelectedEtiquetas, et)}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border transition-colors",
                      selectedEtiquetas.includes(et)
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-muted text-muted-foreground border-border hover:border-accent"
                    )}
                  >
                    {et}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground text-sm">Cargando resultados...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{results.length}</span> resultados encontrados
                </p>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  Ordenar por fecha
                </button>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-foreground font-medium">Sin resultados</p>
                <p className="text-muted-foreground text-sm mt-1">Prueba con otros filtros o términos de búsqueda</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {results.map((doc) => {
                  const Icon = tipoIcons[doc.tipo]
                  return (
                    <Link
                      href={`/factura/${doc.id}`}
                      key={doc.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground">{doc.id}</p>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", tipoConfig[doc.tipo])}>{doc.tipo}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{doc.empresa}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                          {doc.etiquetas.map((et) => (
                            <span key={et} className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{et}</span>
                          ))}
                        </div>
                        <span className="text-sm font-bold text-foreground">{doc.importe}</span>
                        <span className="text-xs text-muted-foreground w-20 text-right">{doc.fecha}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", estadoConfig[doc.estado])}>{doc.estado}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  </div>
</div>
)
}
