import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/register-session
 *
 * Called after every successful login (password or OAuth).
 * Generates a new random session ID, writes it to profiles.active_session_id,
 * and sets an httpOnly cookie. Any previously active session on another device
 * is redirected to login on its next protected page load (active_session_id
 * mismatch) — but that check only runs on Next.js page loads, so on its own
 * it leaves the other device's Supabase tokens live for direct API/client
 * calls. `signOut({ scope: 'others' })` closes that gap: it revokes every
 * other session's refresh token server-side, the same "sign out other
 * devices" GoTrue itself offers, so a leaked or previously-shared session
 * (e.g. a temporary password) stops working everywhere but here rather than
 * merely being redirected next time someone happens to load a page with it.
 */
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  await supabase.auth.signOut({ scope: 'others' })

  const sessionId = crypto.randomUUID()

  await supabase
    .from('profiles')
    .update({ active_session_id: sessionId })
    .eq('id', user.id)

  const response = NextResponse.json({ ok: true })
  response.cookies.set('archivum_sid', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return response
}
