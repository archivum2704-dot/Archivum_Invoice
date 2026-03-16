import { AppShell } from "@/components/app-shell"
import { FacturaView } from "@/components/views/factura-view"

export default function FacturaPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <FacturaView id={params.id} />
    </AppShell>
  )
}
