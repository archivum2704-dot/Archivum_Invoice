import { UsersView } from '@/components/views/users-view'
import { RequirePermission } from '@/components/require-permission'

export default function UsuariosPage() {
  return (
    <RequirePermission section="usuarios">
      <UsersView />
    </RequirePermission>
  )
}
