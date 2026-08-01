import { PresupuestosView } from '@/components/views/presupuestos-view'
import { RequirePermission } from '@/components/require-permission'

export default function PresupuestosPage() {
  return (
    <RequirePermission section="presupuestos">
      <PresupuestosView />
    </RequirePermission>
  )
}
