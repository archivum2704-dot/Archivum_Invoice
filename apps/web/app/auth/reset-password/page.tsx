'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/logo'

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })

    if (resetError) {
      setError(t('errors.generic'))
      setLoading(false)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-foreground font-medium mb-6">
            {t('successMessage', { email })}
          </p>
          <Link href="/auth/login">
            <Button className="w-full">{t('backToLogin')}</Button>
          </Link>
        </div>
      </div>
    )
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

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              {t('email')}
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
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

        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-sm text-primary hover:underline">
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  )
}
