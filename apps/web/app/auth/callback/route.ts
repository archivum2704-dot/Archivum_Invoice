import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Register single-device session
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const sessionId = crypto.randomUUID()
        await supabase.from('profiles').update({ active_session_id: sessionId }).eq('id', user.id)
        const response = NextResponse.redirect(`${origin}${next}`)
        response.cookies.set('archivum_sid', sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        })
        return response
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`)
}
