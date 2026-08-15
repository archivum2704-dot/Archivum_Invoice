import { Lock } from 'lucide-react'
import { LegalPlaceholder } from '@/components/legal-placeholder'

export const metadata = {
  title: 'Política de privacidad · Archivum',
  description: 'Política de privacidad de Archivum — pendiente de redacción legal definitiva.',
}

export default function PrivacidadPage() {
  return (
    <LegalPlaceholder
      icon={Lock}
      title="Política de privacidad"
      subtitle="RGPD y LOPDGDD"
      sections={[
        {
          title: 'Responsable del tratamiento',
          summary: 'Identidad, NIF y contacto de la entidad responsable — pendiente de que la empresa esté constituida.',
        },
        {
          title: 'Qué datos se tratan',
          summary: 'Datos de la cuenta (nombre, correo), de facturación y de los documentos y clientes que cada organización sube a la plataforma.',
        },
        {
          title: 'Finalidad y base legal',
          summary: 'Para qué se usan esos datos y qué base legal ampara cada tratamiento (ejecución del contrato, obligación legal en el caso de Verifactu, consentimiento donde aplique).',
        },
        {
          title: 'Con quién se comparten',
          summary: 'Los proveedores que procesan datos por cuenta de Archivum: Supabase (base de datos y almacenamiento), Resend (correo), Stripe (pagos) y la AEAT cuando una organización está obligada a Verifactu.',
        },
        {
          title: 'Plazo de conservación',
          summary: 'Cuánto tiempo se conservan los datos tras darse de baja, y las excepciones que impone la normativa de facturación.',
        },
        {
          title: 'Derechos de la persona interesada',
          summary: 'Acceso, rectificación, supresión, oposición, portabilidad y limitación — y el canal para ejercerlos.',
        },
        {
          title: 'Seguridad',
          summary: 'Medidas técnicas aplicadas: cifrado en tránsito y en reposo para datos sensibles (certificados digitales), control de acceso por organización, RLS en base de datos.',
        },
      ]}
    />
  )
}
