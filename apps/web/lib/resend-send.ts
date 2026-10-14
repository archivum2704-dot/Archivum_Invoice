import type { Resend } from 'resend'

type SendPayload = Parameters<Resend['emails']['send']>[0]
type SendResult = Awaited<ReturnType<Resend['emails']['send']>>

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Send through Resend, retrying when it only asks us to slow down.
 *
 * Resend allows a couple of requests per second per account; sending several
 * invoices in a row (or an invite while another mail is going out) can hit
 * that and come back as `rate_limit_exceeded`, which is not a real failure.
 * Quota errors are not retried: they will not clear by waiting a second.
 */
export async function sendWithRetry(resend: Resend, payload: SendPayload, attempts = 3): Promise<SendResult> {
  let result = await resend.emails.send(payload)
  for (let i = 1; i < attempts && result.error?.name === 'rate_limit_exceeded'; i++) {
    await sleep(1100 * i)
    result = await resend.emails.send(payload)
  }
  return result
}

/** A Resend error in words the user can act on. */
export function explainResendError(err: { name?: string; message?: string } | null | undefined): string {
  switch (err?.name) {
    case 'daily_quota_exceeded':
      return 'Se ha alcanzado el límite diario de correos del servicio de envío. Se podrá volver a enviar mañana; si pasa a menudo, hay que ampliar el plan de Resend.'
    case 'monthly_quota_exceeded':
      return 'Se ha alcanzado el límite mensual de correos del servicio de envío. Hay que ampliar el plan de Resend para seguir enviando este mes.'
    case 'rate_limit_exceeded':
      return 'Se están enviando demasiados correos seguidos. Espera unos segundos y vuelve a intentarlo.'
    default:
      return err?.message ? `No se pudo enviar el correo: ${err.message}` : 'No se pudo enviar el correo.'
  }
}
