import { Cookie } from 'lucide-react'
import { LegalPlaceholder } from '@/components/legal-placeholder'

export const metadata = {
  title: 'Política de cookies · Archivum',
  description: 'Política de cookies de Archivum — pendiente de redacción legal definitiva.',
}

export default function CookiesPage() {
  return (
    <LegalPlaceholder
      icon={Cookie}
      title="Política de cookies"
      subtitle="LSSICE"
      sections={[
        {
          title: 'Cookies técnicas / necesarias',
          summary: 'La sesión de autenticación (Supabase), el control de sesión única por dispositivo (archivum_sid) y la preferencia de estado del menú lateral. Ninguna requiere consentimiento por ser estrictamente necesaria para el funcionamiento del servicio.',
        },
        {
          title: 'Analítica',
          summary: 'Google Analytics 4 (Google Ireland Ltd.), solo en las páginas públicas y solo si se acepta en el aviso de cookies: cookies _ga y _ga_<ID>, hasta 2 años, para contar visitas y cómo se usa la web, sin señales de Google ni personalización de anuncios. Nunca dentro de la aplicación. Además, Vercel Analytics en las mismas páginas, que no usa cookies ni identificadores persistentes y mide visitas de forma agregada. La elección se puede cambiar en cualquier momento con «Configurar cookies».',
        },
        {
          title: 'Lo que no se usa',
          summary: 'No hay cookies de publicidad, de terceros con fines de perfilado, ni píxeles de redes sociales.',
        },
        {
          title: 'Cómo gestionarlas',
          summary: 'Instrucciones para bloquear o eliminar cookies desde la configuración del navegador, y qué partes del servicio dejarían de funcionar si se bloquean las necesarias.',
        },
      ]}
    />
  )
}
