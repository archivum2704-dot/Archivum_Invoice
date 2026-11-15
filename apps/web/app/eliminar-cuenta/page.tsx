import Link from 'next/link'
import { ArrowLeft, UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ORG_DATA_RETENTION_DAYS } from '@/lib/account-deletion'
import { DeleteAccountForm } from '@/components/delete-account-form'

export const metadata = {
  title: 'Eliminar tu cuenta · Archivum',
  description: 'Cómo eliminar tu cuenta de Archivum y qué datos se borran.',
}

/**
 * Pública a propósito: Google Play exige una dirección web, enlazada desde la
 * ficha de la tienda, donde cualquiera pueda ver cómo pedir el borrado de su
 * cuenta, aunque ya no tenga la app instalada. Con sesión, permite hacerlo aquí.
 */
export default async function EliminarCuentaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="flex items-start gap-3 mb-8">
          <UserX className="w-7 h-7 text-primary shrink-0 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Eliminar tu cuenta de Archivum</h1>
            <p className="text-sm text-muted-foreground mt-1">ARCHIVUM. VV, S.C. · app Archivum para Android, iPhone y web</p>
          </div>
        </div>

        <div className="space-y-9">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Cómo hacerlo</h2>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground text-sm text-foreground leading-relaxed">
              <li><strong>Desde la app del móvil:</strong> Ajustes → Zona de peligro → Eliminar mi cuenta.</li>
              <li><strong>Desde la web:</strong> inicia sesión en archivum.es y vuelve a esta página, o entra en Ajustes → Legal → Eliminar mi cuenta.</li>
              <li><strong>Por correo:</strong> si no puedes entrar, escribe a <a href="mailto:facturas@archivum.es" className="text-primary underline">facturas@archivum.es</a> desde el correo de la cuenta pidiendo que la eliminemos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Qué se borra</h2>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground text-sm text-foreground leading-relaxed">
              <li>Tu cuenta y tus datos de acceso (correo, contraseña, nombre y verificación en dos pasos), al momento. Ya no podrás iniciar sesión.</li>
              <li>Tu acceso a todas las organizaciones de las que formas parte.</li>
              <li>
                Si eres el único miembro de una organización, se cancela su suscripción y sus datos (clientes, documentos,
                pedidos, albaranes y productos) se borran a los {ORG_DATA_RETENTION_DAYS} días.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Qué se conserva</h2>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground text-sm text-foreground leading-relaxed">
              <li>
                <strong>Las facturas emitidas y sus registros VERI*FACTU.</strong> La normativa tributaria obliga a conservarlas y
                no se pueden borrar ni modificar; se guardan bloqueadas durante el plazo legal y después se eliminan.
              </li>
              <li>
                Lo que hayas creado en organizaciones de otras personas (facturas, documentos, clientes) es de esa organización y
                se queda en ella, sin tu nombre como autor.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Antes de eliminarla</h2>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground text-sm text-foreground leading-relaxed">
              <li>Descarga lo que quieras guardar: después ya no podrás entrar para exportarlo.</li>
              <li>
                Si eres el único propietario de una organización en la que hay más personas, primero nombra a otra persona
                propietaria en Usuarios, o quita al resto de miembros.
              </li>
            </ul>
          </section>

          <section className="pt-2">
            {user ? (
              <DeleteAccountForm email={user.email ?? ''} />
            ) : (
              <div className="bg-card border border-border rounded-xl px-4 py-4 text-sm text-foreground">
                <p>Para eliminar la cuenta desde aquí, primero inicia sesión.</p>
                <Link href="/auth/login" className="inline-block mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
                  Iniciar sesión
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
