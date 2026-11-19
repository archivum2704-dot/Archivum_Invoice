'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/logo'
import { createClient } from '@/lib/supabase/client'

/**
 * Destino del enlace de «¿Olvidaste tu contraseña?».
 *
 * Supabase puede mandar aquí el enlace de tres formas, según quién lo pidió y
 * cómo esté la plantilla del correo, y hay que aceptar las tres:
 *   - `?token_hash=…&type=recovery`: plantilla con {{ .TokenHash }}. Funciona
 *     en cualquier dispositivo; es la recomendada.
 *   - `?code=…` (PKCE): lo pide la web. Solo se puede canjear en el mismo
 *     navegador que lo pidió, porque allí está guardado el verificador.
 *   - `#access_token=…&refresh_token=…` (implícito): lo pide la app móvil.
 *
 * Esta página no existía: el enlace llevaba a una ruta inexistente que, además,
 * no era pública, así que el middleware mandaba a la gente al login sin dejarle
 * cambiar la contraseña. Es pública en lib/supabase/proxy.ts.
 */

type Phase = 'checking' | 'ready' | 'saving' | 'done' | 'invalid'
type InvalidReason = 'expired' | 'otherBrowser' | 'missing'

const MIN_LENGTH = 8

export default function UpdatePasswordPage() {
  const t = useTranslations('auth.updatePassword')
  const [phase, setPhase] = useState<Phase>('checking')
  const [reason, setReason] = useState<InvalidReason>('missing')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const url = new URL(window.location.href)
    const query = url.searchParams
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))

    const fail = (r: InvalidReason) => { setReason(r); setPhase('invalid') }
    const ok = () => {
      // Quitar los tokens de la barra de direcciones (y del historial).
      window.history.replaceState(null, '', url.pathname)
      setPhase('ready')
    }

    ;(async () => {
      // Supabase devuelve los enlaces caducados o ya usados con un error.
      if (query.get('error') || hash.get('error')) return fail('expired')

      const tokenHash = query.get('token_hash')
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
        return error ? fail('expired') : ok()
      }

      // getSession espera a que el cliente termine de arrancar. El cliente de
      // la web canjea solo un ?code= cuando puede, así que puede haber sesión ya.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return ok()

      const code = query.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) return ok()
        // Sin verificador: el enlace se abrió en otro navegador o dispositivo.
        return fail(/verifier/i.test(error.message) ? 'otherBrowser' : 'expired')
      }

      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        return error ? fail('expired') : ok()
      }

      fail('missing')
    })().catch(() => fail('expired'))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_LENGTH) return setError(t('errors.tooShort'))
    if (password !== confirm) return setError(t('errors.mismatch'))

    setPhase('saving')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      const code = (updateError as { code?: string }).code
      setError(
        code === 'same_password' ? t('errors.same')
        : code === 'weak_password' ? t('errors.weak')
        : code === 'session_not_found' || code === 'session_expired' ? t('errors.session')
        : t('errors.generic'),
      )
      setPhase('ready')
      return
    }

    // Cerrar la sesión del enlace: quien lo pidió desde el móvil vuelve a la
    // app, y Archivum solo admite una sesión por cuenta, así que dejarla
    // abierta aquí cerraría la del móvil la próxima vez que se cargue la web.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    setPhase('done')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <Logo size={72} showText={false} />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">
              {phase === 'done' ? t('successTitle') : phase === 'invalid' ? t('invalidTitle') : t('title')}
            </h1>
            {(phase === 'ready' || phase === 'saving') && (
              <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
            )}
          </div>
        </div>

        {phase === 'checking' && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('checking')}
          </p>
        )}

        {phase === 'invalid' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground">{t(reason)}</p>
            <Link href="/auth/reset-password">
              <Button className="w-full">{t('requestNew')}</Button>
            </Link>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm text-foreground">{t('successBody')}</p>
            <Link href="/auth/login">
              <Button className="w-full">{t('goToLogin')}</Button>
            </Link>
          </div>
        )}

        {(phase === 'ready' || phase === 'saving') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">{t('password')}</label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={phase === 'saving'}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('hint')}</p>
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-foreground mb-2">{t('confirm')}</label>
              <Input
                id="confirm"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                disabled={phase === 'saving'}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={phase === 'saving'}>
              {phase === 'saving' ? t('submitting') : t('submit')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
