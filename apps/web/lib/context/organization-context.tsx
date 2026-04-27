'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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
  isPlatformAdmin: boolean
  isOrgAdmin: boolean
  loading: boolean
  error: string | null
  switchOrganization: (orgId: string) => Promise<void>
  refreshOrganization: () => Promise<void>
  refreshUserData: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [userOrgs, setUserOrgs] = useState<Organization[]>([])
  const [currentMember, setCurrentMember] = useState<OrganizationMember | null>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setLoading(false)
        return
      }

      // Load profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError
      setUserProfile(profile)

      // Platform admins load all organizations
      if (profile.platform_role === 'super_admin') {
        const { data: allOrgs, error: orgsError } = await supabase
          .from('organizations')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (orgsError) throw orgsError
        setUserOrgs(allOrgs ?? [])

        const activeOrg = allOrgs?.find(o => o.id === profile.current_org_id) ?? allOrgs?.[0] ?? null
        setCurrentOrg(activeOrg)
        setCurrentMember(null)
        setLoading(false)
        return
      }

      // Regular users load their org memberships
      const { data: memberships, error: membError } = await supabase
        .from('organization_members')
        .select('*, organizations(*)')
        .eq('user_id', user.id)

      if (membError) throw membError

      const orgs = (memberships ?? [])
        .map(m => m.organizations as Organization)
        .filter(Boolean)

      setUserOrgs(orgs)

      const activeMembership =
        memberships?.find(m => m.organization_id === profile.current_org_id) ??
        memberships?.[0]

      if (activeMembership) {
        setCurrentOrg(activeMembership.organizations as Organization)
        setCurrentMember(activeMembership as OrganizationMember)
      }
    } catch (err) {
      console.error('Error loading user data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load user data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUserData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') loadUserData()
      if (event === 'SIGNED_OUT') {
        setCurrentOrg(null)
        setUserOrgs([])
        setCurrentMember(null)
        setUserProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUserData])

  const switchOrganization = async (orgId: string) => {
    const org = userOrgs.find(o => o.id === orgId)
    if (!org) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentOrg(org)

    await supabase
      .from('profiles')
      .update({ current_org_id: orgId })
      .eq('id', user.id)

    if (userProfile?.platform_role !== 'super_admin') {
      const { data: member } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .single()

      setCurrentMember(member ?? null)
    } else {
      setCurrentMember(null)
    }
  }

  const refreshOrganization = async () => {
    if (!currentOrg) return
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', currentOrg.id)
      .single()
    if (data) setCurrentOrg(data)
  }

  const isPlatformAdmin = userProfile?.platform_role === 'super_admin'
  const isOrgAdmin = isPlatformAdmin || currentMember?.role === 'owner' || currentMember?.role === 'admin'

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        userOrgs,
        currentMember,
        userProfile,
        isPlatformAdmin,
        isOrgAdmin: isOrgAdmin ?? false,
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
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider')
  return context
}
