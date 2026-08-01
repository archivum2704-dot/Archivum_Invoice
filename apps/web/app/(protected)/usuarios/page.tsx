import { UsersView } from "@/components/views/users-view"
import { redirectViewersAway } from "@/lib/auth/require-role"

export default async function UsuariosPage() {
  await redirectViewersAway()
  return <UsersView />
}
