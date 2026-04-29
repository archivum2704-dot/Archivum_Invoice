import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, firstName, lastName, role, orgId } = body

    if (!email || !orgId || !role) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    // Verify the requesting user is an admin of the org
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: callerMember } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (!callerMember || !['owner', 'admin'].includes(callerMember.role)) {
      return NextResponse.json({ error: 'not_authorized' }, { status: 403 })
    }

    // Enforce 3-user limit (excluding owner)
    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .neq('role', 'owner')

    if (memberCount !== null && memberCount >= 3) {
      return NextResponse.json({ error: 'member_limit_reached' }, { status: 403 })
    }

    // Use admin client to create the user
    const supabaseAdmin = await createClient(true)

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email.toLowerCase().trim())

    if (existingUser) {
      // User already has an account — just add them to the org if not already there
      const { data: alreadyMember } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', existingUser.id)
        .single()

      if (alreadyMember) {
        return NextResponse.json({ error: 'already_member' }, { status: 409 })
      }

      await supabaseAdmin.from('organization_members').insert({
        organization_id: orgId,
        user_id: existingUser.id,
        role,
        invited_by: user.id,
      })

      return NextResponse.json({ success: true, existing: true })
    }

    // New user — invite via Supabase (sends activation email)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://archivum2704-dot.vercel.app'

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      {
        data: {
          first_name: firstName ?? '',
          last_name: lastName ?? '',
        },
        redirectTo: `${appUrl}/auth/callback`,
      }
    )

    if (inviteError || !inviteData?.user) {
      return NextResponse.json({ error: inviteError?.message ?? 'invite_failed' }, { status: 400 })
    }

    // Add to organization
    await supabaseAdmin.from('organization_members').insert({
      organization_id: orgId,
      user_id: inviteData.user.id,
      role,
      invited_by: user.id,
    })

    return NextResponse.json({ success: true, existing: false })

  } catch (err) {
    console.error('[create-member]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
