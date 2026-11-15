/**
 * Borrado de cuenta (exigido por Google Play). Copia de
 * apps/web/lib/account-deletion.ts: la palabra de confirmación y los días
 * tienen que coincidir con los del servidor. Los mensajes van en locales/.
 */

/** Lo que hay que escribir para confirmar. El servidor no acepta otra cosa. */
export const ACCOUNT_DELETION_CONFIRM_WORD = "ELIMINAR";

/** Días que se conservan los datos de una organización que se queda sin miembros. */
export const ORG_DATA_RETENTION_DAYS = 15;

/** Página pública con el procedimiento (la que se enlaza en Google Play). */
export const ACCOUNT_DELETION_PATH = "/eliminar-cuenta";
