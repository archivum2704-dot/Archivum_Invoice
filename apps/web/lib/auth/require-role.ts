import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side guard for pages a read-only member must not reach.
 *
 * The sidebar already hides these entries, but hiding a link is not access
 * control: typing the URL still rendered a full upload/creation form that only
 * failed once it hit the database. Viewers are sent back to the dashboard.
 */
export async function redirectViewersAway(to = '/dashboard') {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('platform_role, current_org_id')
    .eq('id', user.id)
    .single()

  if (profile?.platform_role === 'super_admin') return
  if (!profile?.current_org_id) return

  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', profile.current_org_id)
    .eq('user_id', user.id)
    .single()

  if (member?.role === 'viewer') redirect(to)
}
