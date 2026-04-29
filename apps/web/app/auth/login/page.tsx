'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Building2, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

type Tab = 'empresa' | 'usuario'

export default function LoginPage() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('empresa')

  // Shared fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyCode, setCompanyCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const input = 'w-full px-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'

  // ── Empresa login (owner / admin) ──────────────────────────
  const handleEmpresaLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(t('errors.invalidCredentials'))
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  // ── Usuario / gestor login ─────────────────────────────────
  const handleUsuarioLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    // Step 1 — auth
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(t('errors.invalidCredentials'))
      setLoading(false)
      return
    }

    // Step 2 — verify company code and membership
    const code = companyCode.trim().toUpperCase()
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('access_code', code)
      .single()

    if (!org) {
      // Wrong code or user is not a member of that org
      await supabase.auth.signOut()
      setError(t('errors.invalidCompanyCode'))
      setLoading(false)
      return
    }

    // Step 3 — set the org as current
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ current_org_id: org.id })
        .eq('id', user.id)
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <Logo size={72} showText={false} />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Archivum</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-2 bg-muted rounded-xl p-1 mb-6">
          <button
            onClick={() => { setTab('empresa'); setError(null) }}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              tab === 'empresa'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Building2 className="w-4 h-4" />
            {t('tabEmpresa')}
          </button>
          <button
            onClick={() => { setTab('usuario'); setError(null) }}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              tab === 'usuario'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <User className="w-4 h-4" />
            {t('tabUsuario')}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={tab === 'empresa' ? handleEmpresaLogin : handleUsuarioLogin} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('email')}</label>
            <input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              required
              className={input}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('password')}</label>
            <input
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              required
              className={input}
            />
          </div>

          {/* Company code — only on usuario tab */}
          {tab === 'usuario' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t('companyCode')}</label>
              <input
                type="text"
                placeholder={t('companyCodePlaceholder')}
                value={companyCode}
                onChange={e => setCompanyCode(e.target.value.toUpperCase())}
                disabled={loading}
                required
                maxLength={6}
                className={cn(input, 'tracking-widest font-mono uppercase')}
              />
              <p className="text-xs text-muted-foreground mt-1">{t('companyCodeHint')}</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? t('submitting') : t('submit')}
          </button>
        </form>

        {/* Footer links — only for empresa tab */}
        {tab === 'empresa' && (
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('noAccount')}{' '}
              <Link href="/auth/signup" className="text-primary hover:underline font-medium">
                {t('signUp')}
              </Link>
            </p>
            <Link href="/auth/reset-password" className="text-sm text-primary hover:underline">
              {t('forgotPassword')}
            </Link>
          </div>
        )}

        {tab === 'usuario' && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t('usuarioHint')}
          </p>
        )}
      </div>
    </div>
  )
}
