'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/lib/context/organization-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/logo'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function OnboardingPage() {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const { refreshUserData } = useOrganization()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOrgName(e.target.value)
    setOrgSlug(slugify(e.target.value))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    // Use the DB function that creates org + sets owner membership atomically
    const { error: fnError } = await supabase.rpc('create_organization_with_owner', {
      org_name: orgName.trim(),
      org_slug: orgSlug,
      owner_id: user.id,
    })

    if (fnError) {
      setError(fnError.message)
      setLoading(false)
      return
    }

    await refreshUserData()
    router.push('/dashboard')
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
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

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="orgName" className="block text-sm font-medium text-foreground mb-2">
              {t('orgName')}
            </label>
            <Input
              id="orgName"
              placeholder="Acme S.L."
              value={orgName}
              onChange={handleNameChange}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="orgSlug" className="block text-sm font-medium text-foreground mb-2">
              {t('orgSlug')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">archivum.app/</span>
              <Input
                id="orgSlug"
                value={orgSlug}
                onChange={e => setOrgSlug(slugify(e.target.value))}
                disabled={loading}
                required
                className="flex-1"
              />
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={loading || !orgName.trim()} className="w-full">
            {loading ? t('creating') : t('create')}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
