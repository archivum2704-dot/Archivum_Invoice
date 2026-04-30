'use client'

import { use } from 'react'
import { EditarView } from '@/components/views/editar-view'

export default function EditarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <EditarView id={id} />
}
