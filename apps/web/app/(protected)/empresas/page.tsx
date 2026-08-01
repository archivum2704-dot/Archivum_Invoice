import { EmpresasView } from '@/components/views/empresas-view'
import { redirectViewersAway } from '@/lib/auth/require-role'

export default async function EmpresasPage() {
  await redirectViewersAway()
  return <EmpresasView />
}
