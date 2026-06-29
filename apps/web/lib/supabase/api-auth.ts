import { createClient as createSbClient } from '@supabase/supabase-js'
import { createClient as createCookieClient } from '@/lib/supabase/server'

/**
 * Returns a Supabase client authenticated as the caller, supporting BOTH:
 *  - Web: cookie-based session (Next.js server client)
 *  - Mobile: `Authorization: Bearer <access_token>` header
 *
 * In both cases RLS is enforced as the calling user, so API routes can be
 * shared by the web and mobile apps without weakening security.
 */
export async function getApiClient(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createSbClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return await createCookieClient()
}
