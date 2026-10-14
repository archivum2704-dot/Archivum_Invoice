/**
 * Errors from the Supabase Auth calls that send mail (sign up, password
 * reset), in Spanish. Their raw message ("email rate limit exceeded") reached
 * users untranslated.
 *
 * The rate limit is Supabase's, not ours: without a custom SMTP server the
 * project can only send a handful of auth emails per hour. The fix is to set
 * Resend as SMTP in Supabase (Authentication → Emails → SMTP Settings).
 *
 * Copied as-is in apps/mobile/lib/auth-email-errors.ts.
 */
export function explainAuthEmailError(err: { code?: string; message?: string; status?: number } | null | undefined): string {
  const msg = (err?.message ?? "").toLowerCase()
  if (err?.code === "over_email_send_rate_limit" || err?.status === 429 || msg.includes("rate limit")) {
    return "Se han enviado demasiados correos de acceso en poco tiempo. Espera unos minutos y vuelve a intentarlo."
  }
  if (err?.code === "user_already_exists" || msg.includes("already registered")) {
    return "Ya existe una cuenta con ese correo. Inicia sesión o recupera la contraseña."
  }
  if (err?.code === "weak_password" || msg.includes("password should be")) {
    return "La contraseña es demasiado débil. Usa al menos 8 caracteres."
  }
  if (err?.code === "email_address_invalid" || msg.includes("invalid") && msg.includes("email")) {
    return "La dirección de correo no es válida."
  }
  return err?.message ? `No se pudo completar: ${err.message}` : "No se pudo completar la operación."
}
