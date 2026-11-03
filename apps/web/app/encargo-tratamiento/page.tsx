import { ShieldCheck } from 'lucide-react'
import { LegalDocument } from '@/components/legal-document'
import { ENCARGO_TRATAMIENTO } from '@/lib/legal/encargo-tratamiento'
import { LEGAL_VERSION_LABEL } from '@/lib/legal/version'

export const metadata = {
  title: 'Contrato de encargo del tratamiento · Archivum',
  description: 'Contrato de encargo del tratamiento de datos personales (art. 28 RGPD) entre Archivum y sus clientes.',
}

export default function EncargoTratamientoPage() {
  return (
    <LegalDocument
      icon={ShieldCheck}
      title="Contrato de encargo del tratamiento de datos personales"
      subtitle="Versión 1.0 · artículo 28 del RGPD"
      lastUpdated={LEGAL_VERSION_LABEL}
      intro={[{ type: 'p', text: 'Este contrato lo acepta electrónicamente cada cliente al registrarse o contratar Archivum, y queda registrada la versión aceptada y la fecha. Entra en vigor en la fecha de esa aceptación.' }]}
      articles={ENCARGO_TRATAMIENTO}
      footer={[
        { type: 'p', text: 'Por ARCHIVUM. VV, S.C. (NIF J93941003): Dña. Virginia Ocaña del Cura y Dña. María Victoria Peña Ruiz, CEO.' },
        { type: 'p', text: 'Por el RESPONSABLE: aceptación electrónica al registrarse o contratar el servicio.' },
      ]}
    />
  )
}
