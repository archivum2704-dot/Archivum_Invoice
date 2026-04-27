"use client"

import { useState } from "react"
import {
  Building2,
  Search,
  Plus,
  FileText,
  MoreHorizontal,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useOrganization } from "@/lib/context/organization-context"
import { useCompanies } from "@/lib/hooks/use-companies"

const mockEmpresas = [
  {
    id: 1,
    nombre: "Construcciones García SL",
    cif: "B-12345678",
    sector: "Construcción",
    ciudad: "Madrid",
    telefono: "+34 91 234 56 78",
    email: "admin@construccionesgarcia.es",
    documentos: 124,
    importe_total: "248.600 €",
    color: "bg-blue-500",
    initials: "CG",
  },
  {
    id: 2,
    nombre: "Distribuciones Norte SA",
    cif: "A-87654321",
    sector: "Distribución",
    ciudad: "Bilbao",
    telefono: "+34 94 321 65 43",
    email: "contabilidad@disnorte.es",
    documentos: 98,
    importe_total: "192.340 €",
    color: "bg-emerald-600",
    initials: "DN",
  },
  {
    id: 3,
    nombre: "Servicios Tech SL",
    cif: "B-55566677",
    sector: "Tecnología",
    ciudad: "Barcelona",
    telefono: "+34 93 555 66 77",
    email: "facturacion@serviciostech.es",
    documentos: 67,
    importe_total: "310.120 €",
    color: "bg-violet-600",
    initials: "ST",
  },
  {
    id: 4,
    nombre: "Transportes Iberia SA",
    cif: "A-11122233",
    sector: "Transporte",
    ciudad: "Sevilla",
    telefono: "+34 95 111 22 23",
    email: "admin@transportesiberia.es",
    documentos: 152,
    importe_total: "87.450 €",
    color: "bg-orange-500",
    initials: "TI",
  },
  {
    id: 5,
    nombre: "Suministros del Sur SL",
    cif: "B-44455566",
    sector: "Suministros",
    ciudad: "Valencia",
    telefono: "+34 96 444 55 56",
    email: "contabilidad@sumdelsur.es",
    documentos: 89,
    importe_total: "134.780 €",
    color: "bg-rose-600",
    initials: "SS",
  },
  {
    id: 6,
    nombre: "Logística Peninsular SA",
    cif: "A-77788899",
    sector: "Logística",
    ciudad: "Zaragoza",
    telefono: "+34 97 777 88 89",
    email: "facturas@logpen.es",
    documentos: 73,
    importe_total: "156.900 €",
    color: "bg-teal-600",
    initials: "LP",
  },
]

export function EmpresasView() {
  const [search, setSearch] = useState("")
  const { currentOrg } = useOrganization()
  const { companies, loading } = useCompanies(currentOrg?.id || null)

  const empresas = companies.map((company, index) => ({
    id: company.id,
    nombre: company.name,
    cif: company.cif,
    sector: company.sector || "General",
    ciudad: company.city || "N/A",
    telefono: company.phone || "N/A",
    email: company.email || "N/A",
    documentos: 0,
    importe_total: `${company.total_invoiced.toFixed(2)} €`,
    color: ["bg-blue-500", "bg-emerald-600", "bg-purple-600", "bg-orange-500", "bg-pink-500"][index % 5],
    initials: company.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('')
  }))

  const filtered = empresas.filter(
    (e) =>
      e.nombre.toLowerCase().includes(search.toLowerCase()) ||
      e.cif.toLowerCase().includes(search.toLowerCase()) ||
      e.sector.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">Empresas y Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{empresas.length} empresas registradas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar empresa, CIF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Nueva Empresa
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-5">
        {filtered.map((empresa) => (
          <div
            key={empresa.id}
            className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow group"
          >
            {/* Top bar */}
            <div className="h-1.5 bg-primary" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold", empresa.color)}>
                    {empresa.initials}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm leading-tight">{empresa.nombre}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">CIF: {empresa.cif}</p>
                  </div>
                </div>
                <button className="p-1 rounded hover:bg-muted transition-colors">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{empresa.ciudad} · {empresa.sector}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{empresa.telefono}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{empresa.email}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-1.5 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{empresa.documentos}</span>
                  <span className="text-muted-foreground">docs</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total facturado</p>
                  <p className="text-sm font-semibold text-foreground">{empresa.importe_total}</p>
                </div>
              </div>
            </div>

            <div className="px-5 pb-4">
              <Link
                href={`/biblioteca?empresa=${empresa.id}`}
                className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                Ver documentos
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
