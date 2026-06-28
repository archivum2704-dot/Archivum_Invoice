import { FacturaEmitidaView } from '@/components/views/factura-emitida-view'

export default async function FacturaEmitidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FacturaEmitidaView id={id} />
}
