import { FacturacionView } from '@/components/views/facturacion-view'
import { RequirePermission } from '@/components/require-permission'

export default function FacturacionPage() {
  return (
    <RequirePermission section="facturacion">
      <FacturacionView />
    </RequirePermission>
  )
}
