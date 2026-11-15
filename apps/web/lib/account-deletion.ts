/**
 * Borrado de cuenta (exigido por Google Play). Copiado en
 * apps/mobile/lib/account-deletion.ts: si cambia aquí, cambia allí.
 */

/** Lo que hay que escribir para confirmar. El servidor no acepta otra cosa. */
export const ACCOUNT_DELETION_CONFIRM_WORD = 'ELIMINAR'

/**
 * Días que se conservan los datos de una organización que se queda sin
 * miembros, antes de borrarlos. Los mismos 15 que al cancelar la suscripción.
 */
export const ORG_DATA_RETENTION_DAYS = 15

/** Mensaje para cada error que puede devolver /api/account/delete. */
export function explainAccountDeletionError(code: string | undefined, organizations?: string[]): string {
  switch (code) {
    case 'owner_with_members':
      return `Eres el único propietario de ${organizations?.length ? organizations.join(', ') : 'una organización'} y hay más personas en ella. Antes de eliminar tu cuenta, nombra a otra persona propietaria en Usuarios, o quita al resto de miembros.`
    case 'confirmation_required':
      return `Escribe ${ACCOUNT_DELETION_CONFIRM_WORD} para confirmar.`
    case 'unauthorized':
      return 'Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.'
    case 'stripe_cancel_failed':
      return 'No se pudo cancelar tu suscripción, así que no se ha eliminado nada. Inténtalo de nuevo en unos minutos o escríbenos a facturas@archivum.es.'
    default:
      return 'No se pudo eliminar la cuenta. Inténtalo de nuevo o escríbenos a facturas@archivum.es.'
  }
}
