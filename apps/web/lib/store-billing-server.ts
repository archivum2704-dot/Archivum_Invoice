import type { SupabaseClient } from '@supabase/supabase-js'
import type { BillingStore } from '@/lib/store-billing'

/**
 * La tienda que cobra la suscripción de la organización, o null si la cobra
 * Stripe o no hay ninguna. Consulta aparte y tolerante: si la migración
 * 20261126_store_billing.sql todavía no está aplicada, la columna no existe y
 * se devuelve null en vez de romper la consulta principal de facturación.
 */
export async function getBillingStore(client: SupabaseClient<any, any, any>, orgId: string): Promise<BillingStore | null> {
  const { data, error } = await client.from('organizations').select('billing_store').eq('id', orgId).maybeSingle()
  if (error || !data) return null
  const v = (data as { billing_store?: string | null }).billing_store
  return v === 'app_store' || v === 'play_store' ? v : null
}
