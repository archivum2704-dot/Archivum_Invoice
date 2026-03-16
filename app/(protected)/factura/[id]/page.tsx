'use client'

import { FacturaView } from '@/components/views/factura-view'

export default function FacturaPage({ params }: { params: { id: string } }) {
  return <FacturaView id={params.id} />
}
