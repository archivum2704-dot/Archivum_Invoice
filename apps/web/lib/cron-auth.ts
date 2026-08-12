import { timingSafeEqual } from 'crypto'

/**
 * Who may run a scheduled job.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on its own cron requests,
 * reading the env var at call time — so rotating the secret needs no code
 * change, only a redeploy so both sides see the new value.
 *
 * The check refuses when the secret is not configured at all. Comparing
 * against an unset variable yields the literal string "Bearer undefined",
 * which anyone could send: the endpoint would look protected while being open
 * to the internet. Closed is the safe failure here — a job that does not run
 * is visible, one that anyone can trigger is not.
 */
export function cronRequestIsAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) {
    console.error('[cron] CRON_SECRET is not set — refusing every scheduled request')
    return false
  }
  const expected = Buffer.from(`Bearer ${secret}`)
  const got = Buffer.from(request.headers.get('authorization') ?? '')
  // Constant-time compare: a length check is unavoidable (timingSafeEqual
  // throws on mismatched lengths) and leaks only the secret's length, not its
  // content, which a fixed-format "Bearer <secret>" header already reveals to
  // anyone who knows CRON_SECRET's configured length.
  return expected.length === got.length && timingSafeEqual(expected, got)
}
