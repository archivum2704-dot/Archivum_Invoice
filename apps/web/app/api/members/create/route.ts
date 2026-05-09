import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(`Missing env vars: url=${!!url} key=${!!key}`)
  }
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

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

    // Use plain supabase-js admin client for auth.admin.* operations
    const admin = getAdminClient()

    // Check if user already exists by listing and filtering
    // (getUserByEmail is not available in all versions — listUsers with filter is safer)
    const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) {
      console.error('[create-member] listUsers error:', listErr)
      return NextResponse.json({ error: 'server_error', detail: listErr.message }, { status: 500 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existingUser = existingUsers?.users?.find(u => u.email === normalizedEmail)

    if (existingUser) {
      // User already has an account — just add them to the org if not already there
      const { data: alreadyMember } = await admin
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', existingUser.id)
        .single()

      if (alreadyMember) {
        return NextResponse.json({ error: 'already_member' }, { status: 409 })
      }

      const { error: insertErr } = await admin.from('organization_members').insert({
        organization_id: orgId,
        user_id: existingUser.id,
        role,
        invited_by: user.id,
      })
      if (insertErr) {
        console.error('[create-member] insert existing member error:', insertErr)
        return NextResponse.json({ error: 'server_error', detail: insertErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, existing: true })
    }

    // New user — invite via Supabase (sends activation email)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://archivum2704-dot.vercel.app'

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: {
          first_name: firstName ?? '',
          last_name: lastName ?? '',
        },
        redirectTo: `${appUrl}/auth/callback`,
      }
    )

    if (inviteError || !inviteData?.user) {
      console.error('[create-member] inviteUserByEmail error:', inviteError)
      return NextResponse.json({ error: inviteError?.message ?? 'invite_failed' }, { status: 400 })
    }

    // Add to organization
    const { error: memberInsertErr } = await admin.from('organization_members').insert({
      organization_id: orgId,
      user_id: inviteData.user.id,
      role,
      invited_by: user.id,
    })
    if (memberInsertErr) {
      console.error('[create-member] insert new member error:', memberInsertErr)
      return NextResponse.json({ error: 'server_error', detail: memberInsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, existing: false })

  } catch (err) {
    console.error('[create-member] unhandled error:', err)
    return NextResponse.json({ error: 'server_error', detail: String(err) }, { status: 500 })
  }
}
