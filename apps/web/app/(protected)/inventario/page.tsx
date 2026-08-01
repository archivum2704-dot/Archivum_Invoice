import { InventarioView } from '@/components/views/inventario-view'
import { RequirePermission } from '@/components/require-permission'

export default function InventarioPage() {
  return (
    <RequirePermission section="inventario">
      <InventarioView />
    </RequirePermission>
  )
}
