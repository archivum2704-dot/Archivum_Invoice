'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type Organization = Database['public']['Tables']['organizations']['Row']
type OrganizationMember = Database['public']['Tables']['organization_members']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

interface OrganizationContextType {
  currentOrg: Organization | null
  userOrgs: Organization[]
  currentMember: OrganizationMember | null
  userProfile: Profile | null
  userRole: string | null
  loading: boolean
  error: string | null
  switchOrganization: (orgId: string) => void
  refreshOrganization: () => Promise<void>
  refreshUserData: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [userOrgs, setUserOrgs] = useState<Organization[]>([])
  const [currentMember, setCurrentMember] = useState<OrganizationMember | null>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadUserData = async () => {
    try {
      setLoading(true)

      // DEMO MODE: Load from localStorage/Session
      const demoEmail = localStorage.getItem('demo_user_email')
      const demoRole = localStorage.getItem('demo_user_role')

      if (!demoEmail) {
        setLoading(false)
        return
      }

      setUserRole(demoRole || 'company_user')
      
      const mockProfile = {
        id: demoEmail === 'admin@test.com' ? 'admin-123' : 'empresa-123',
        email: demoEmail,
        first_name: demoEmail === 'admin@test.com' ? 'Admin' : 'Empresa',
        last_name: 'Test',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      setUserProfile(mockProfile)

      if (demoRole === 'admin') {
        const adminOrg = {
          id: 'admin-global',
          name: 'Panel Global (Admin)',
          slug: 'admin-global',
          industry: 'Administración',
          logo_url: null,
          website: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        setCurrentOrg(adminOrg as any)
        setUserOrgs([adminOrg] as any)
        setCurrentMember({ organization_id: 'admin-global', user_id: mockProfile.id, role: 'owner' } as any)
      } else {
        const companyOrg = {
          id: 'demo-org-1',
          name: 'Mi Empresa Demo',
          slug: 'demo-empresa',
          industry: 'Servicios',
          logo_url: null,
          website: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        setCurrentOrg(companyOrg as any)
        setUserOrgs([companyOrg] as any)
        setCurrentMember({ organization_id: 'demo-org-1', user_id: mockProfile.id, role: 'owner' } as any)
      }

      setError(null)
    } catch (err) {
      console.error('Error loading mock user data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  // Load user profile and organizations on mount
  useEffect(() => {
    loadUserData()
  }, [supabase])

  const switchOrganization = (orgId: string) => {
    // SECURITY: Only admins can switch between organizations
    if (userRole !== 'admin') {
      console.warn('Security: Non-admin attempted to switch organization')
      return
    }

    const org = userOrgs.find((o) => o.id === orgId)
    if (org) {
      setCurrentOrg(org)
      localStorage.setItem('current_org_id', orgId)

      // Find member record for this org
      supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', userProfile?.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setCurrentMember(data)
          }
        })
    }
  }

  const refreshOrganization = async () => {
    if (!currentOrg) return

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', currentOrg.id)
        .single()

      if (error) throw error
      if (data) {
        setCurrentOrg(data)
      }
    } catch (err) {
      console.error('Error refreshing organization:', err)
    }
  }

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        userOrgs,
        currentMember,
        userProfile,
        userRole,
        loading,
        error,
        switchOrganization,
        refreshOrganization,
        refreshUserData: loadUserData,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return context
}
