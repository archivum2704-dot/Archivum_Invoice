'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'

export default function LoginPage() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <Logo size={72} showText={false} />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Archivum</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              {t('email')}
            </label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              {t('password')}
            </label>
            <Input
              id="password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t('submitting') : t('submit')}
          </Button>
        </form>

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
      </div>
    </div>
  )
}
