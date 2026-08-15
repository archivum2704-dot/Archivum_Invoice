import { FileText } from 'lucide-react'
import { LegalPlaceholder } from '@/components/legal-placeholder'

export const metadata = {
  title: 'Términos y condiciones · Archivum',
  description: 'Términos y condiciones de servicio de Archivum — pendiente de redacción legal definitiva.',
}

export default function TerminosPage() {
  return (
    <LegalPlaceholder
      icon={FileText}
      title="Términos y condiciones de servicio"
      subtitle="Condiciones de uso"
      sections={[
        {
          title: 'Objeto del servicio',
          summary: 'Qué es Archivum: SaaS de facturación y gestión documental, y qué queda fuera de su alcance.',
        },
        {
          title: 'Registro y cuenta',
          summary: 'Condiciones para darse de alta, veracidad de los datos aportados y responsabilidad sobre el uso de las credenciales.',
        },
        {
          title: 'Planes, precios y facturación',
          summary: 'Cómo funcionan los planes de suscripción, el cobro a través de Stripe, la renovación y la cancelación.',
        },
        {
          title: 'Responsabilidad del usuario',
          summary: 'La veracidad de los datos fiscales que el usuario introduce (NIF, importes, causas de exención...) es responsabilidad suya — Archivum genera el registro y lo remite, no valida su contenido tributario.',
        },
        {
          title: 'Limitación de responsabilidad',
          summary: 'Qué cubre y qué no cubre Archivum ante fallos del servicio, indisponibilidad o errores derivados de terceros (AEAT, Supabase, Stripe).',
        },
        {
          title: 'Propiedad intelectual',
          summary: 'Titularidad del software y de los datos que cada organización sube.',
        },
        {
          title: 'Modificación de estos términos',
          summary: 'Cómo y con qué antelación se comunican los cambios.',
        },
        {
          title: 'Ley aplicable y jurisdicción',
          summary: 'Legislación española y fuero al que se someten las partes.',
        },
      ]}
    />
  )
}
