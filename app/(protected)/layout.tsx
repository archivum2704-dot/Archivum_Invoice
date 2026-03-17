'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/lib/context/organization-context'
import { AppShell } from '@/components/app-shell'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { currentOrg, loading, userRole } = useOrganization()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      // DEMO MODE: Check cookie instead of Supabase session
      const hasDemoSession = document.cookie.includes('demo_session=true')

      if (!hasDemoSession) {
        router.push('/auth/login')
        return
      }

      // If user has no organization and is NOT an admin, redirect to onboarding
      // (In demo mode, fallbacks in context usually prevent this)
      if (!loading && !currentOrg && userRole !== 'admin') {
        router.push('/onboarding')
      }
    }

    checkAuth()
  }, [router, loading, currentOrg, userRole])

  if (loading || (!currentOrg && userRole !== 'admin')) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <svg className="w-8 h-8 text-primary mx-auto animate-spin mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return <AppShell>{children}</AppShell>
}
