'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Building2, User, FileText, Shield, Users, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { cn } from '@/lib/utils'

type Tab = 'empresa' | 'usuario'

const FEATURES = [
  { icon: FileText, key: 'feat1' },
  { icon: Shield,   key: 'feat2' },
  { icon: Users,    key: 'feat3' },
  { icon: Download, key: 'feat4' },
] as const

const FEATURE_TEXTS: Record<string, { en: string; es: string }> = {
  feat1: { en: 'Upload PDFs, images and scans in seconds',         es: 'Sube PDFs, imágenes y escaneos en segundos' },
  feat2: { en: 'Roles and permissions for your whole team',        es: 'Roles y permisos para todo tu equipo' },
  feat3: { en: 'Manage multiple companies and clients',            es: 'Gestiona múltiples empresas y clientes' },
  feat4: { en: 'Export to CSV or Excel with a single click',       es: 'Exporta a CSV o Excel con un clic' },
}

export default function LoginPage() {
  const t       = useTranslations('auth.login')
  const tCommon = useTranslations('common')
  const locale  = useLocale()
  const isEn   = locale === 'en'
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('empresa')

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [companyCode, setCompanyCode] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const input = 'w-full px-3 py-2.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground'

  const handleEmpresaLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(t('errors.invalidCredentials')); setLoading(false); return }
    router.push('/dashboard'); router.refresh()
  }

  const handleUsuarioLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(t('errors.invalidCredentials')); setLoading(false); return }
    const code = companyCode.trim().toUpperCase()
    const { data: org } = await supabase.from('organizations').select('id, name').eq('access_code', code).single()
    if (!org) {
      await supabase.auth.signOut()
      setError(t('errors.invalidCompanyCode'))
      setLoading(false); return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ current_org_id: org.id }).eq('id', user.id)
    router.push('/dashboard'); router.refresh()
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — branding (desktop only) ─────────────── */}
      <div className="hidden lg:flex lg:w-[58%] bg-sidebar flex-col justify-between p-14 relative overflow-hidden">

        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />

        {/* Logo */}
        <Logo
          size={44}
          showText
          invert
          textClassName="text-sidebar-foreground text-xl font-bold"
        />

        {/* Hero copy + features */}
        <div className="space-y-10 relative z-10">
          <div>
            <h2 className="text-[2.6rem] font-bold text-sidebar-foreground leading-tight mb-4">
              {isEn
                ? 'Centralise all your invoices\nin one place'
                : 'Centraliza todas tus facturas\nen un solo lugar'}
            </h2>
            <p className="text-sidebar-foreground/55 text-lg leading-relaxed max-w-md">
              {isEn
                ? 'Stop losing fiscal documents. Archive, search and export everything from a single panel.'
                : 'Olvídate de perder documentos fiscales. Archiva, busca y exporta todo desde un único panel.'}
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-sidebar-foreground/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-sidebar-foreground/75" />
                </div>
                <span className="text-sidebar-foreground/65 text-sm leading-snug">
                  {isEn ? FEATURE_TEXTS[key].en : FEATURE_TEXTS[key].es}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/25 relative z-10">
          © {new Date().getFullYear()} Archivum · Todos los derechos reservados
        </p>
      </div>

      {/* ── Right panel — form ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            {tCommon('backToHome')}
          </Link>
          <LanguageSwitcher variant="light" dropdownDirection="down" />
        </div>

        {/* Form area */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 pb-16">
          <div className="w-full max-w-[360px]">

            {/* Mobile logo */}
            <div className="flex flex-col items-center mb-8 gap-3 lg:hidden">
              <Logo size={56} showText={false} />
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">Archivum</h1>
                <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
              </div>
            </div>

            {/* Heading (desktop) */}
            <div className="mb-7 hidden lg:block">
              <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
              <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
            </div>

            {/* Tab switcher */}
            <div className="grid grid-cols-2 bg-muted rounded-xl p-1 mb-6">
              {(['empresa', 'usuario'] as Tab[]).map((id) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setError(null) }}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                    tab === id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {id === 'empresa' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  {id === 'empresa' ? t('tabEmpresa') : t('tabUsuario')}
                </button>
              ))}
            </div>

            {/* Form */}
            <form
              onSubmit={tab === 'empresa' ? handleEmpresaLogin : handleUsuarioLogin}
              className="space-y-4"
            >
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

            {/* Footer links */}
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
      </div>
    </div>
  )
}
