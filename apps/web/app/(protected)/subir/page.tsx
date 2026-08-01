import { SubirView } from '@/components/views/subir-view'
import { redirectViewersAway } from '@/lib/auth/require-role'

export default async function SubirPage() {
  await redirectViewersAway()
  return <SubirView />
}
