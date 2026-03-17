'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/lib/context/organization-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function OnboardingPage() {
  const router = useRouter()
  // DEMO MODE: If we are already logged in via demo, go to dashboard
  if (typeof window !== 'undefined' && document.cookie.includes('demo_session=true')) {
    router.push('/dashboard')
    return null
  }
  const { refreshUserData } = useOrganization()
  const [step, setStep] = useState<'organization' | 'details'>('organization')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    organizationName: '',
    organizationSlug: '',
    industry: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const createOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: formData.organizationName,
          slug: formData.organizationSlug.toLowerCase().replace(/\s+/g, '-'),
          industry: formData.industry,
        })
        .select()
        .single()

      if (orgError) {
        setError(orgError.message)
        setLoading(false)
        return
      }

      // Add user as owner
      const { error: memberError } = await supabase.from('organization_members').insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
      })

      if (memberError) {
        setError(memberError.message)
        setLoading(false)
        return
      }

      // Store organization ID in localStorage for quick access
      localStorage.setItem('current_org_id', org.id)

      // Refresh context data so ProtectedLayout sees the new org
      await refreshUserData()

      router.push('/')
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Bienvenido a DocVault</h1>
          <p className="text-muted-foreground">Configura tu primera organización</p>
        </div>

        <form onSubmit={createOrganization} className="space-y-4">
          <div>
            <label htmlFor="organizationName" className="block text-sm font-medium text-foreground mb-2">
              Nombre de la empresa
            </label>
            <Input
              id="organizationName"
              name="organizationName"
              placeholder="Mi Empresa S.L."
              value={formData.organizationName}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="organizationSlug" className="block text-sm font-medium text-foreground mb-2">
              URL amigable
            </label>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground mr-2">app.docvault.io/</span>
              <Input
                id="organizationSlug"
                name="organizationSlug"
                placeholder="mi-empresa"
                value={formData.organizationSlug}
                onChange={handleChange}
                disabled={loading}
                required
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-foreground mb-2">
              Sector (opcional)
            </label>
            <Input
              id="industry"
              name="industry"
              placeholder="Ej: Consultoría, Retail, etc."
              value={formData.industry}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creando...' : 'Crear organización'}
          </Button>
        </form>
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground mb-4">
            ¿Quieres entrar con otra cuenta?
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/auth/login')
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )
}
