import type { PlanId } from '@/lib/pricing'

/**
 * Productos que se venden dentro de las apps (App Store y Google Play).
 *
 * Los mismos ID se crean en App Store Connect, en Play Console y en
 * RevenueCat; si se cambia uno aquí hay que cambiarlo allí, y al revés.
 * Decisión del 25 de noviembre de 2026: en la app se venden los tres planes
 * (mismo precio final que la web, IVA incluido) y el bono de documentos. Los
 * usuarios extra solo se contratan en la web.
 *
 * Copia en apps/mobile/lib/store-billing.ts (cuando exista la pantalla de
 * compras del móvil).
 */
export const STORE_PLAN_PRODUCTS: Record<string, Exclude<PlanId, 'free'>> = {
  'archivum.starter.mensual':  'starter',
  'archivum.business.mensual': 'business',
  'archivum.pro.mensual':      'pro',
}

/** Bono de 250 documentos, compra única (consumible). */
export const STORE_DOCS_PACK_PRODUCT = 'archivum.bono.250docs'

export type BillingStore = 'app_store' | 'play_store'

/**
 * El plan de un producto de tienda. Google Play puede enviar el ID con el
 * plan base detrás («archivum.pro.mensual:mensual»), así que se compara la
 * parte anterior a los dos puntos.
 */
export function planForStoreProduct(productId: string | null | undefined): Exclude<PlanId, 'free'> | null {
  if (!productId) return null
  return STORE_PLAN_PRODUCTS[productId.split(':')[0]] ?? null
}

export function isDocsPackProduct(productId: string | null | undefined): boolean {
  return !!productId && productId.split(':')[0] === STORE_DOCS_PACK_PRODUCT
}

/** Nombre de la tienda para los textos de la interfaz. */
export function storeLabel(store: string | null | undefined): string | null {
  if (store === 'app_store') return 'App Store'
  if (store === 'play_store') return 'Google Play'
  return null
}
