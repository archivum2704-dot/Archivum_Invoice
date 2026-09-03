'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'

export default function MfaChallengePage() {
  const t = useTranslations('mfa.challenge')
  const router = useRouter()
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Find the verified TOTP factor to challenge. If the session turns out to
  // already be at aal2 (e.g. the user navigated here directly after already
  // completing the challenge in another tab), just move on.
  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.currentLevel === 'aal2') { router.replace('/dashboard'); return }
        const { data, error: err } = await supabase.auth.mfa.listFactors()
        const factor = data?.totp.find(f => f.status === 'verified')
        if (err || !factor) {
          // No verified factor to challenge — nothing to do here.
          router.replace('/dashboard')
          return
        }
        setFactorId(factor.id)
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 50)
      } catch {
        // A dropped connection here would otherwise leave the page on its
        // full-screen spinner forever, with no input to retry from.
        setError(t('connectionError'))
        setLoading(false)
      }
    })()
  }, [router, t])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setVerifying(true); setError(null)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (err) {
        setError(t('invalidCode'))
        setCode('')
        setVerifying(false)
        inputRef.current?.focus()
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError(t('connectionError'))
      setCode('')
      setVerifying(false)
      inputRef.current?.focus()
    }
  }

  const handleCancel = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center mb-8 gap-3">
          <Logo size={48} showText={false} />
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={verifying}
            className="w-full px-3 py-3 text-center text-2xl tracking-[0.5em] font-mono bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {verifying ? t('verifying') : t('verify')}
          </button>
        </form>

        <button
          type="button"
          onClick={handleCancel}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('signOutInstead')}
        </button>
      </div>
    </div>
  )
}
