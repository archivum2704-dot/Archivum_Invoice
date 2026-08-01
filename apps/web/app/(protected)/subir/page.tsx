import { SubirView } from '@/components/views/subir-view'
import { RequirePermission } from '@/components/require-permission'

export default function SubirPage() {
  return (
    <RequirePermission section="subir">
      <SubirView />
    </RequirePermission>
  )
}
