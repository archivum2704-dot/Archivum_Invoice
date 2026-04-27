'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Mail } from 'lucide-react'

export default function SignupSuccessPage() {
  const t = useTranslations('auth.signupSuccess')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">{t('title')}</h2>
        <p className="text-muted-foreground mb-8">{t('message')}</p>
        <Link href="/auth/login">
          <Button variant="outline" className="w-full">{t('backToLogin')}</Button>
        </Link>
      </div>
    </div>
  )
}
