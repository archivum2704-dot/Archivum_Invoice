'use client'

import { use } from 'react'
import { FacturaView } from '@/components/views/factura-view'

export default function FacturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <FacturaView id={id} />
}
