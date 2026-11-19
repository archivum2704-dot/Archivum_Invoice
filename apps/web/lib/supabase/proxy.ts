import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { TAX_ACCESS_COOKIE, TAX_ACCESS_HOME, isTaxAccessPage } from '@/lib/tax-authority-access'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/signup',
    '/auth/signup-success',
    '/auth/reset-password',
    // Destination of the password-reset email link. The visitor has no session
    // yet (the page creates it from the link), so it must not bounce to login.
    '/auth/update-password',
    '/auth/callback',
    '/auth/error',
    '/setup',
    // Art. 13.2 of RD 1007/2023: the declaración responsable must be available
    // to the client when they acquire the product — before they have an account.
    '/declaracion-responsable',
    // A privacy policy, cookie notice or terms of service that only a logged-in
    // user could read would defeat their purpose — a visitor deciding whether
    // to sign up has no account yet.
    '/privacidad',
    '/cookies',
    '/terminos',
    '/encargo-tratamiento',
    // Google Play links here from the store listing: anyone, signed in or not,
    // must be able to read how to delete their account.
    '/eliminar-cuenta',
  ]
  const isPublicRoute = publicRoutes.some(route =>
    route === '/'
      ? request.nextUrl.pathname === '/'
      : request.nextUrl.pathname.startsWith(route),
  )

  // API routes authenticate themselves and answer in JSON — they accept a
  // bearer token as well as a session cookie, which is how the mobile app
  // calls them. This check only knows about cookies, so it saw every mobile
  // request as anonymous and redirected it to the login page: the app then
  // received an HTML document where it expected JSON and died with
  // "Unexpected character: <". Let the routes answer for themselves.
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  if (!user && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Two-factor gate: a user who enrolled a verified TOTP factor gets a
  // session capped at aal1 right after password sign-in — currentLevel only
  // reaches aal2 once they pass the second-factor challenge. API routes are
  // exempt for the same reason unauthenticated ones are: the mobile app
  // doesn't do this challenge yet and answers for itself.
  const isMfaChallengeRoute = request.nextUrl.pathname.startsWith('/auth/mfa')
  // The reset link opens with a session of its own (the page creates it), and
  // someone already signed in may open it too: neither must be sent away
  // before they can type the new password.
  const isPasswordUpdate = request.nextUrl.pathname.startsWith('/auth/update-password')
  let mfaPending = false
  if (user && !isApiRoute) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    mfaPending = !!aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel
  }

  if (user && mfaPending && !isMfaChallengeRoute && !isApiRoute && !isPasswordUpdate) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/mfa'
    return NextResponse.redirect(url)
  }

  // «Acceso de la Administración tributaria» (RD 1007/2023, art. 8.4): a
  // session opened with that box checked only reaches the pages with tax
  // significance, and cannot write through the API. See
  // lib/tax-authority-access.ts.
  const taxAccess = request.cookies.get(TAX_ACCESS_COOKIE)?.value === '1'

  if (user && !mfaPending && request.nextUrl.pathname.startsWith('/auth/') && !isPasswordUpdate) {
    const url = request.nextUrl.clone()
    url.pathname = taxAccess ? TAX_ACCESS_HOME : '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user && !mfaPending && taxAccess) {
    const path = request.nextUrl.pathname
    if (isApiRoute) {
      if (request.method !== 'GET' && request.method !== 'HEAD' && !path.startsWith('/api/auth/')) {
        return NextResponse.json({ error: 'tax_authority_read_only' }, { status: 403 })
      }
    } else if (!isPublicRoute && !isTaxAccessPage(path)) {
      const url = request.nextUrl.clone()
      url.pathname = TAX_ACCESS_HOME
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
