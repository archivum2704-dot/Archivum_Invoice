"use client"

import { useState } from "react"
import { AlertTriangle, Download, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface CancellationModalProps {
  open: boolean
  onClose: () => void
  /** Called after user confirms — execute the actual cancel API call here */
  onConfirm: () => Promise<void>
}

const STEPS = [
  {
    icon: Download,
    title: "Descarga todos tus documentos",
    body: "Una vez cancelada la suscripción no podrás acceder, visualizar ni descargar los documentos que hayas subido. Descárgalos todos antes de continuar.",
  },
  {
    icon: Trash2,
    title: "Eliminación automática a los 15 días",
    body: "Si no renuevas tu suscripción en los próximos 15 días, tu cuenta y TODOS los datos almacenados (documentos, clientes, equipo) serán eliminados de forma permanente e irrecuperable.",
  },
  {
    icon: AlertTriangle,
    title: "Sin acceso durante el periodo de gracia",
    body: "Durante los 15 días posteriores a la cancelación no podrás subir, descargar ni editar documentos. Solo podrás renovar para recuperar el acceso.",
  },
]

export function CancellationModal({ open, onClose, onConfirm }: CancellationModalProps) {
  const [understood, setUnderstood] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    if (!understood) return
    setConfirming(true)
    try { await onConfirm() } finally { setConfirming(false) }
  }

  const handleClose = () => {
    setUnderstood(false)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-destructive/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-base font-bold text-foreground">Cancelar suscripción</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Antes de cancelar, lee detenidamente lo que ocurrirá con tu cuenta y tus datos:
          </p>

          <div className="space-y-3">
            {STEPS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3 p-3.5 bg-muted/50 rounded-xl border border-border">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={understood}
              onChange={e => setUnderstood(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-destructive"
            />
            <span className="text-sm text-foreground leading-snug">
              He descargado todos mis documentos y entiendo que{" "}
              <strong>no podré recuperarlos</strong> si no renuevo en 15 días.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Mantener suscripción
          </button>
          <button
            onClick={handleConfirm}
            disabled={!understood || confirming}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-lg transition-colors",
              understood && !confirming
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {confirming ? "Cancelando…" : "Sí, cancelar mi suscripción"}
          </button>
        </div>
      </div>
    </div>
  )
}
