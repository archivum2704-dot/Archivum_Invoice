"use client"

import { AlertTriangle, XCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface SubscriptionBannerProps {
  status: "past_due" | "canceled" | "unpaid" | "paused" | "expired"
  daysUntilDeletion: number | null
  /** true = user can still read but cannot write */
  readOnly: boolean
}

export function SubscriptionBanner({ status, daysUntilDeletion, readOnly }: SubscriptionBannerProps) {
  const isUrgent = daysUntilDeletion !== null && daysUntilDeletion <= 5
  const isCritical = daysUntilDeletion !== null && daysUntilDeletion <= 0

  let title = "Tu suscripción ha vencido"
  let body  = "No puedes subir, descargar ni editar documentos hasta que renueves. Si no renuevas en los próximos días, tu cuenta y todos tus datos serán eliminados permanentemente."

  if (status === "past_due" || status === "unpaid") {
    title = "Pago pendiente"
    body  = "El último cobro de tu suscripción ha fallado. Actualiza tu método de pago para recuperar el acceso completo."
  } else if (status === "paused") {
    title = "Suscripción pausada"
    body  = "Tu suscripción está pausada. Reactívala para volver a subir y editar documentos."
  }

  if (isCritical) {
    title = "⚠️ Cuenta programada para eliminación"
    body  = "El plazo ha vencido. Tu cuenta y todos sus documentos serán eliminados en las próximas horas. Descarga todo ahora y renueva para cancelar la eliminación."
  } else if (isUrgent && daysUntilDeletion !== null) {
    title = `⚠️ Tu cuenta se eliminará en ${daysUntilDeletion} día${daysUntilDeletion === 1 ? "" : "s"}`
  } else if (daysUntilDeletion !== null && daysUntilDeletion > 0) {
    title = `Suscripción cancelada — ${daysUntilDeletion} día${daysUntilDeletion === 1 ? "" : "s"} para eliminación de datos`
  }

  return (
    <div className={cn(
      "w-full px-4 py-3 flex items-start gap-3 text-sm border-b",
      isUrgent || isCritical
        ? "bg-destructive/10 border-destructive/30 text-destructive"
        : "bg-yellow-500/10 border-yellow-500/30 text-yellow-800 dark:text-yellow-400"
    )}>
      {isUrgent || isCritical
        ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
        : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{title}. </span>
        <span className="opacity-90">{body}</span>
      </div>
      <Link
        href="/configuracion?tab=billing"
        className={cn(
          "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap",
          isUrgent || isCritical
            ? "bg-destructive text-white border-destructive hover:bg-destructive/90"
            : "bg-yellow-600 text-white border-yellow-600 hover:bg-yellow-700"
        )}
      >
        <RefreshCw className="w-3 h-3" />
        Renovar ahora
      </Link>
    </div>
  )
}
