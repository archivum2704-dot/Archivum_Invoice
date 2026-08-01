import { EmpresasView } from '@/components/views/empresas-view'
import { RequirePermission } from '@/components/require-permission'

export default function EmpresasPage() {
  return (
    <RequirePermission section="empresas">
      <EmpresasView />
    </RequirePermission>
  )
}
