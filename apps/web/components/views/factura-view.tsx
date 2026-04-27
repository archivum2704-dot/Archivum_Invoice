"use client"

import {
  ArrowLeft,
  Download,
  Printer,
  Share2,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  FileText,
  Tag,
  Hash,
  MoreHorizontal,
  Eye,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface FacturaViewProps {
  id: string
}

const etiquetaColors = ["bg-blue-100 text-blue-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700"]

export function FacturaView({ id }: FacturaViewProps) {
  const doc = {
    id: id || "FAC-2024-0892",
    tipo: "Factura",
    estado: "Pagada",
    fecha_emision: "14 de marzo de 2024",
    fecha_vencimiento: "14 de abril de 2024",
    fecha_pago: "20 de marzo de 2024",
    empresa_emisora: {
      nombre: "Construcciones Garcia SL",
      cif: "B-12345678",
      direccion: "Calle Mayor 45, 28001 Madrid",
      email: "admin@construccionesgarcia.es",
    },
    empresa_receptora: {
      nombre: "Servicios Integrales SA",
      cif: "A-99988877",
      direccion: "Avda. Diagonal 200, 08005 Barcelona",
      email: "facturas@serviciosintegrales.es",
    },
    lineas: [
      { descripcion: "Trabajos de albanileria, Fase 1", cantidad: 1, precio_unit: "2.500,00 EUR", total: "2.500,00 EUR" },
      { descripcion: "Materiales de construccion (cemento, aridos)", cantidad: 1, precio_unit: "850,00 EUR", total: "850,00 EUR" },
      { descripcion: "Mano de obra especializada (20h)", cantidad: 20, precio_unit: "45,00 EUR", total: "900,00 EUR" },
    ],
    subtotal: "4.250,00 EUR",
    iva: "21%",
    iva_importe: "892,50 EUR",
    total: "5.142,50 EUR",
    forma_pago: "Transferencia bancaria",
    etiquetas: ["Obra", "Madrid", "Construccion"],
    notas: "Factura correspondiente a los trabajos realizados en el proyecto Residencial Las Acacias. Segunda emision conforme a contrato marco ref. CM-2024-001.",
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <Link href="/biblioteca" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver a la biblioteca
        </Link>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors">
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors">
            <Share2 className="w-4 h-4" />
            Compartir
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Download className="w-4 h-4" />
            Descargar PDF
          </button>
          <button className="p-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors">
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-5">
            <div className="bg-primary px-8 py-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-6 h-6 text-primary-foreground/80" />
                  <span className="text-primary-foreground/70 text-sm font-medium uppercase tracking-wide">{doc.tipo}</span>
                </div>
                <h1 className="text-3xl font-bold text-primary-foreground">{doc.id}</h1>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-white/20 text-white">
                <CheckCircle2 className="w-4 h-4" />
                {doc.estado}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-border">
              {[
                { label: "Fecha de emision", value: doc.fecha_emision, Icon: Calendar },
                { label: "Fecha de vencimiento", value: doc.fecha_vencimiento, Icon: Clock },
                { label: "Fecha de pago", value: doc.fecha_pago, Icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.label} className="bg-card px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <item.Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            {[
              { title: "Empresa Emisora", data: doc.empresa_emisora },
              { title: "Empresa Receptora", data: doc.empresa_receptora },
            ].map(({ title, data }) => (
              <div key={title} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
                </div>
                <p className="font-semibold text-foreground mb-1">{data.nombre}</p>
                <p className="text-xs text-muted-foreground mb-0.5">CIF: {data.cif}</p>
                <p className="text-xs text-muted-foreground mb-0.5">{data.direccion}</p>
                <p className="text-xs text-muted-foreground">{data.email}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden mb-5">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Descripcion</span>
              <span className="text-right">Cantidad</span>
              <span className="text-right">Precio unit.</span>
              <span className="text-right">Total</span>
            </div>
            <div className="divide-y divide-border">
              {doc.lineas.map((linea, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3.5">
                  <span className="text-sm text-foreground">{linea.descripcion}</span>
                  <span className="text-sm text-muted-foreground text-right">{linea.cantidad}</span>
                  <span className="text-sm text-muted-foreground text-right">{linea.precio_unit}</span>
                  <span className="text-sm font-medium text-foreground text-right">{linea.total}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border bg-muted/20 px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">{doc.subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA ({doc.iva})</span>
                <span className="font-medium text-foreground">{doc.iva_importe}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-2">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{doc.total}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notas</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{doc.notas}</p>
          </div>
        </div>

        <aside className="w-64 shrink-0 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Detalles</p>
            <div className="space-y-3">
              {[
                { label: "Numero", value: doc.id, Icon: Hash },
                { label: "Tipo", value: doc.tipo, Icon: FileText },
                { label: "Forma de pago", value: doc.forma_pago, Icon: User },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2.5">
                  <item.Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Etiquetas</p>
            <div className="flex flex-wrap gap-1.5">
              {doc.etiquetas.map((et, i) => (
                <span key={et} className={cn("text-xs px-2 py-0.5 rounded-full", etiquetaColors[i % etiquetaColors.length])}>
                  {et}
                </span>
              ))}
              <button className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors">
                <Tag className="w-3 h-3 inline mr-1" />
                Añadir
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Archivos Adjuntos</p>
            <div className="space-y-2">
              {["factura_0892.pdf", "albaran_anexo.pdf"].map((file) => (
                <div key={file} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-pointer group">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{file}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    <Download className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Actividad</p>
            <div className="space-y-3">
              {[
                { accion: "Pago registrado", fecha: "20 mar 2024", user: "M. Admin" },
                { accion: "Documento subido", fecha: "14 mar 2024", user: "M. Admin" },
                { accion: "Factura creada", fecha: "14 mar 2024", user: "Sistema" },
              ].map((act, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{act.accion}</p>
                    <p className="text-xs text-muted-foreground">{act.fecha} - {act.user}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
