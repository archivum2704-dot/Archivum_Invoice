import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient(admin = false) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  // Admin client: uses service-role key, no cookie session needed
  if (admin) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (never commit it).')
    }
    return createServerClient(supabaseUrl, serviceRoleKey, {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  // Regular user client: cookie-based session
  const cookieStore = await cookies()
  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — safe to ignore.
          }
        },
      },
    },
  )
}
