import { AlbaranesView } from '@/components/views/albaranes-view'
import { RequirePermission } from '@/components/require-permission'

export default function AlbaranesPage() {
  return (
    <RequirePermission section="albaranes">
      <AlbaranesView />
    </RequirePermission>
  )
}
