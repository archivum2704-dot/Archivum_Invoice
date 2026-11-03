import { FileText } from 'lucide-react'
import { LegalDocument } from '@/components/legal-document'
import { AVISO_LEGAL } from '@/lib/legal/aviso-legal'
import { LEGAL_VERSION_LABEL } from '@/lib/legal/version'

export const metadata = {
  title: 'Aviso legal y condiciones · Archivum',
  description: 'Aviso legal, condiciones de uso y condiciones de contratación de Archivum.',
}

// Sustituye a los «Términos y condiciones» del 1 de septiembre de 2026: el
// abogado entregó este texto, más completo, para ocupar su lugar.
export default function TerminosPage() {
  return (
    <LegalDocument
      icon={FileText}
      title="Aviso legal, condiciones de uso y condiciones de contratación"
      subtitle="Archivum"
      lastUpdated={LEGAL_VERSION_LABEL}
      articles={AVISO_LEGAL}
      footer={[{ type: 'p', text: 'El contrato de encargo del tratamiento de datos personales está disponible en archivum.es/encargo-tratamiento.' }]}
    />
  )
}
