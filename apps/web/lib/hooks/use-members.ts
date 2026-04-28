import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { OrgRole } from '@/lib/supabase/types'

export type OrgMember = {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
  invited_by: string | null
  joined_at: string
  profile: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

export type CompanyAccess = {
  id: string
  company_id: string
  user_id: string
  can_upload: boolean
  can_edit: boolean
  can_delete: boolean
}

async function fetchMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      id, organization_id, user_id, role, invited_by, joined_at,
      profile:profiles ( id, email, first_name, last_name, avatar_url )
    `)
    .eq('organization_id', orgId)
    .order('joined_at')

  if (error) throw error
  return (data ?? []) as OrgMember[]
}

async function fetchMemberCompanyAccess(orgId: string, userId: string): Promise<CompanyAccess[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('company_user_access')
    .select('id, company_id, user_id, can_upload, can_edit, can_delete')
    .eq('organization_id', orgId)
    .eq('user_id', userId)

  if (error) throw error
  return data ?? []
}

export function useMembers(orgId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId ? ['members', orgId] : null,
    () => fetchMembers(orgId!),
    { revalidateOnFocus: false },
  )
  return { members: data ?? [], loading: isLoading, error, mutate }
}

export function useMemberCompanyAccess(orgId: string | null, userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    orgId && userId ? ['company-access', orgId, userId] : null,
    () => fetchMemberCompanyAccess(orgId!, userId!),
    { revalidateOnFocus: false },
  )
  return { access: data ?? [], loading: isLoading, error, mutate }
}
