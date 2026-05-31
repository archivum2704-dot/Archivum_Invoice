'use client'

import { DashboardView } from '@/components/views/dashboard-view'

export default function DashboardPage() {
  // El Panel Principal siempre muestra el dashboard de la organización actual.
  // Los super admins tienen un enlace separado "Panel Admin" (/admin-dashboard)
  // para la vista global de la plataforma.
  return <DashboardView />
}
