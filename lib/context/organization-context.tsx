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

  // Load user profile and organizations
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true)

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        // Extract user role from metadata
        const role = user.user_metadata?.role || 'company_user'
        setUserRole(role)

        // Load user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError
        }

        setUserProfile(profile || null)

        // Load user's organizations
        const { data: members, error: membersError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('user_id', user.id)

        if (membersError) throw membersError

        // Get organization details
        if (members && members.length > 0) {
          const orgIds = members.map((m) => m.organization_id)
          const { data: orgs, error: orgsError } = await supabase
            .from('organizations')
            .select('*')
            .in('id', orgIds)

          if (orgsError) throw orgsError

          setUserOrgs(orgs || [])

          // Set current org from localStorage or first org
          const savedOrgId = localStorage.getItem('current_org_id')
          const selectedOrg = savedOrgId ? orgs?.find((o) => o.id === savedOrgId) : orgs?.[0]

          if (selectedOrg) {
            setCurrentOrg(selectedOrg)
            const member = members.find((m) => m.organization_id === selectedOrg.id)
            setCurrentMember(member || null)
          }
        }

        setError(null)
      } catch (err) {
        console.error('Error loading user data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load user data')
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [supabase])

  const switchOrganization = (orgId: string) => {
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
