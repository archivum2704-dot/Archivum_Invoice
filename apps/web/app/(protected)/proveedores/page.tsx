import { EmpresasView } from '@/components/views/empresas-view'
import { RequirePermission } from '@/components/require-permission'

// Same screen as Clientes, listing suppliers; same permission.
export default function ProveedoresPage() {
  return (
    <RequirePermission section="empresas">
      <EmpresasView role="supplier" />
    </RequirePermission>
  )
}
