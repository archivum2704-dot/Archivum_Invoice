import { FacturasCompraView } from '@/components/views/facturas-compra-view'
import { RequirePermission } from '@/components/require-permission'

export default function FacturasCompraPage() {
  return (
    <RequirePermission section="biblioteca">
      <FacturasCompraView />
    </RequirePermission>
  )
}
