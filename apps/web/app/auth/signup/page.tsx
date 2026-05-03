'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'

export default function SignupPage() {
  const t       = useTranslations('auth.signup')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError(t('errors.passwordMismatch'))
      setLoading(false)
      return
    }
    if (formData.password.length < 8) {
      setError(t('errors.passwordTooShort'))
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/auth/signup-success')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Back button */}
      <div className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          {tCommon('backToHome')}
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <Logo size={72} showText={false} />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Archivum</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
                {t('firstName')}
              </label>
              <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} disabled={loading} required />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
                {t('lastName')}
              </label>
              <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} disabled={loading} required />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              {t('email')}
            </label>
            <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} disabled={loading} required />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              {t('password')}
            </label>
            <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} disabled={loading} required />
            <p className="text-xs text-muted-foreground mt-1">{t('passwordHint')}</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
              {t('confirmPassword')}
            </label>
            <Input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} disabled={loading} required />
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

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t('hasAccount')}{' '}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              {t('signIn')}
            </Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}
