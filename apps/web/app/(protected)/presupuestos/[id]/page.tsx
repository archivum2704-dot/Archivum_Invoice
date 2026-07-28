import { PresupuestoDetalleView } from '@/components/views/presupuesto-detalle-view'

export default async function PresupuestoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PresupuestoDetalleView id={id} />
}
