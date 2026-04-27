"use client"

import { useState, useMemo } from "react"
import {
  FileText,
  Receipt,
  Package,
  FolderOpen,
  Search,
  Plus,
  Filter,
  Calendar,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useOrganization } from "@/lib/context/organization-context"
import { useDocuments } from "@/lib/hooks/use-documents"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function CompanyDashboardView() {
  const { currentOrg } = useOrganization()
  const { documents, loading } = useDocuments(currentOrg?.id || null)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = 
        doc.document_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((doc as any).metadata as any)?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = filterType === "all" || doc.document_type === filterType
      const matchesStatus = filterStatus === "all" || doc.status === filterStatus
      
      return matchesSearch && matchesType && matchesStatus
    })
  }, [documents, searchQuery, filterType, filterStatus])

  // Stats calculation
  const stats = [
    { label: "Documentos", value: filteredDocuments.length, icon: FolderOpen, color: "text-primary" },
    { label: "Facturas", value: filteredDocuments.filter(d => d.document_type === 'invoice').length, icon: FileText, color: "text-blue-500" },
    { label: "Reportes", value: filteredDocuments.filter(d => d.document_type === 'report').length, icon: Package, color: "text-orange-500" },
    { label: "Recibos", value: filteredDocuments.filter(d => d.document_type === 'receipt').length, icon: Receipt, color: "text-green-500" },
  ]

  return (
    <div className="p-8 space-y-8">
      {/* Header & Search Area */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mi Panel de Gestión</h1>
            <p className="text-muted-foreground">{currentOrg?.name || 'Cargando empresa...'}</p>
          </div>
          <Link href="/subir">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Documento
            </Button>
          </Link>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número o cliente..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <select 
              className="bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Todos los tipos</option>
              <option value="invoice">Facturas</option>
              <option value="report">Reportes</option>
              <option value="receipt">Recibos</option>
            </select>

            <select 
              className="bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Cualquier estado</option>
              <option value="sent">Enviado</option>
              <option value="draft">Borrador</option>
              <option value="overdue">Vencido</option>
            </select>

            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              Fecha
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={cn("w-5 h-5", stat.color)} />
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Documents List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Documentos y Registros</h2>
          <span className="text-xs text-muted-foreground">{filteredDocuments.length} resultados encontrados</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left">Número</th>
                <th className="px-6 py-3 text-left">Tipo</th>
                <th className="px-6 py-3 text-left">Fecha</th>
                <th className="px-6 py-3 text-left">Estado</th>
                <th className="px-6 py-3 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                    Cargando documentos...
                  </td>
                </tr>
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                    {searchQuery ? 'No se encontraron documentos con esos filtros' : 'Aún no tiene documentos subidos'}
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30 transition-colors group cursor-pointer">
                    <td className="px-6 py-4 font-medium text-foreground">{doc.document_number}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        doc.document_type === 'invoice' ? "bg-blue-100 text-blue-700" :
                        doc.document_type === 'report' ? "bg-orange-100 text-orange-700" :
                        "bg-green-100 text-green-700"
                      )}>
                        {doc.document_type === 'invoice' ? 'Factura' : 
                         doc.document_type === 'report' ? 'Reporte' : 'Recibo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(doc.date).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "flex items-center gap-1.5 text-xs font-semibold",
                        doc.status === 'sent' ? "text-green-600" :
                        doc.status === 'draft' ? "text-yellow-600" : "text-red-600"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          doc.status === 'sent' ? "bg-green-600" :
                          doc.status === 'draft' ? "bg-yellow-600" : "bg-red-600"
                        )} />
                        {doc.status === 'sent' ? 'Enviado' : 
                         doc.status === 'draft' ? 'Borrador' : 'Vencido'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">
                      {doc.total_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
