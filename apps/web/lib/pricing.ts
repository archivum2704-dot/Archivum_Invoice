/**
 * Archivum — Pricing constants (single source of truth)
 *
 * Planes base:
 *   free     →  0 €/mes  · 1 usuario                · 20  docs/mes (250/año  · 0,5 GB)
 *   starter  → 14,99 €/mes · 2 usuarios (admin+gestor) · 75  docs/mes (900/año  · 1,8 GB)
 *   business → 19,99 €/mes · 2 usuarios (admin+gestor) · 200 docs/mes (2.400/año · 4,8 GB)
 *   pro      → 24,99 €/mes · 2 usuarios (admin+gestor) · 450 docs/mes (5.400/año · 10,8 GB)
 *
 * Add-ons:
 *   Bono 250 docs extra → 4,99 € (pago único, sin caducidad · max 0,5 GB)
 *   Usuario extra (miembro) → 4,99 €/mes
 *
 * Roles de usuario:
 *   admin  → acceso completo a todas las carpetas y documentos
 *   gestor → acceso de solo lectura/descarga a las carpetas que el admin autorice
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Gratuito",
    price: 0,
    priceLabel: "0 €",
    priceSuffix: "para siempre",
    docsPerMonth: 20,
    docsPerYear: 250,
    storageGB: 0.5,
    users: 1,
    highlight: false,
    badge: null,
    description: "Para empezar a ordenar tu documentación sin coste.",
    features: [
      "1 usuario incluido",
      "20 documentos/mes · 250/año (0,5 GB)",
      "Facturas, albaranes, pedidos, recibos",
      "Búsqueda avanzada y filtros",
      "Exportación CSV y Excel",
      "Flujo Pedido → Albarán → Factura",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 14.99,
    priceLabel: "14,99 €",
    priceSuffix: "/ mes",
    docsPerMonth: 75,
    docsPerYear: 900,
    storageGB: 1.8,
    users: 2,
    highlight: false,
    badge: null,
    description: "Para autónomos y pequeños negocios que empiezan a crecer.",
    features: [
      "2 usuarios incluidos (admin + gestor)",
      "75 documentos/mes · 900/año (1,8 GB)",
      "Todo lo del plan Gratuito",
      "Usuarios extra (miembro): 4,99 €/mes",
      "Bono 250 docs adicionales: 4,99 €",
      "Soporte por correo",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 19.99,
    priceLabel: "19,99 €",
    priceSuffix: "/ mes",
    docsPerMonth: 200,
    docsPerYear: 2400,
    storageGB: 4.8,
    users: 2,
    highlight: true,
    badge: "MÁS POPULAR",
    description: "Para pymes con volumen documental medio y varios gestores.",
    features: [
      "2 usuarios incluidos (admin + gestor)",
      "200 documentos/mes · 2.400/año (4,8 GB)",
      "Todo lo del plan Starter",
      "Usuarios extra (miembro): 4,99 €/mes",
      "Bono 250 docs adicionales: 4,99 €",
      "Soporte prioritario",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 24.99,
    priceLabel: "24,99 €",
    priceSuffix: "/ mes",
    docsPerMonth: 450,
    docsPerYear: 5400,
    storageGB: 10.8,
    users: 2,
    highlight: false,
    badge: null,
    description: "Para pymes con alto volumen documental y máxima capacidad.",
    features: [
      "2 usuarios incluidos (admin + gestor)",
      "450 documentos/mes · 5.400/año (10,8 GB)",
      "Todo lo del plan Business",
      "Usuarios extra (miembro): 4,99 €/mes",
      "Bono 250 docs adicionales: 4,99 €",
      "Soporte prioritario + gestor de cuenta",
    ],
  },
} as const

export type PlanId = keyof typeof PLANS

/** Add-ons (precios fijos) */
export const ADDONS = {
  extraDocs: {
    label: "Bono 250 documentos extra",
    sublabel: "Pago único · sin caducidad · máx. 0,5 GB",
    price: 4.99,
    priceLabel: "4,99 €",
    docs: 250,
  },
  extraUser: {
    label: "Usuario adicional (miembro)",
    sublabel: "Por usuario / mes · acceso controlado por el admin",
    price: 4.99,
    priceLabel: "4,99 €/mes",
  },
} as const

/** FAQ entries shown in pricing sections */
export const PRICING_FAQ = [
  {
    q: "¿Los documentos no usados del mes se pierden?",
    a: "No. La cuota no consumida se acumula. Si tienes 75 docs/mes y solo subes 50, el próximo mes podrás subir 100.",
  },
  {
    q: "¿El bono de documentos extra caduca?",
    a: "No. Los 250 documentos del bono no tienen fecha de caducidad. Se descuentan a medida que los vas usando.",
  },
  {
    q: "¿Qué puede hacer el usuario gestor?",
    a: "El gestor solo puede ver y descargar documentos de las carpetas que el administrador le autorice expresamente. No puede subir, editar ni eliminar nada.",
  },
  {
    q: "¿Puedo cancelar en cualquier momento?",
    a: "Sí, sin permanencia ni penalización. Al cancelar tienes 15 días para descargar tus documentos antes de que la cuenta se elimine.",
  },
  {
    q: "¿El plan Gratuito caduca?",
    a: "No. El plan gratuito es para siempre. No te pediremos tarjeta para seguir usándolo.",
  },
] as const

// ── Entitlements ─────────────────────────────────────────────────────────────

/**
 * The billing columns every limit is derived from.
 *
 * plan and status are required, not optional: a caller that forgets to select
 * subscription_plan would otherwise fall through to the free tier and quietly
 * report the wrong limit — which is exactly how the clients screen came to
 * show "1/1" on a Pro organization. Missing them is now a compile error.
 */
export type BillingRow = {
  subscription_plan: string | null
  subscription_status: string | null
  extra_users_quantity?: number | null
  extra_docs_quantity?: number | null
  extra_companies_quantity?: number | null
}

export type Entitlements = {
  planId: PlanId
  /** The plan is in force (paid and current, or granted by an admin). */
  isActive: boolean
  maxUsers: number
  maxDocs: number
  maxCompanies: number
}

/** Platform admins are never capped; a number, not Infinity, so it renders. */
export const UNLIMITED = 999_999

/** Statuses that mean the plan is in force right now. */
const ACTIVE_STATUSES = ['active', 'trialing']

/** Clients (companies) allowed on a paid plan before add-ons. */
const PAID_BASE_COMPANIES = 20

/**
 * The single definition of what an organization is entitled to.
 *
 * Everything — the counters on screen and the checks that refuse a create —
 * must read its limits from here. They used to be worked out in three places
 * with three different rules: one required a Stripe subscription, one only
 * looked at the status, and one ignored both. An organization on a
 * hand-granted plan was told it had 2 user slots and then refused the second.
 *
 * A Stripe subscription is deliberately *not* required: plans granted from the
 * admin panel are just as real. What makes that safe is that the billing
 * columns are writable only by the service role and platform admins — see the
 * protect_billing_columns trigger.
 */
export function resolveEntitlements(
  org: BillingRow | null | undefined,
  opts: { isPlatformAdmin?: boolean } = {},
): Entitlements {
  const planId = ((org?.subscription_plan ?? 'free') as PlanId) in PLANS
    ? (org?.subscription_plan ?? 'free') as PlanId
    : 'free'

  const isActive =
    planId !== 'free' && ACTIVE_STATUSES.includes(org?.subscription_status ?? '')

  if (opts.isPlatformAdmin) {
    return { planId, isActive: true, maxUsers: UNLIMITED, maxDocs: UNLIMITED, maxCompanies: UNLIMITED }
  }

  const plan = PLANS[planId] ?? PLANS.free
  const extraUsers     = org?.extra_users_quantity ?? 0
  const extraDocs      = org?.extra_docs_quantity ?? 0
  const extraCompanies = org?.extra_companies_quantity ?? 0

  // An inactive plan falls back to the free allowance rather than to zero, so
  // an expired subscription keeps read access and the free tier's limits.
  if (!isActive) {
    return {
      planId,
      isActive: false,
      maxUsers: PLANS.free.users,
      maxDocs: PLANS.free.docsPerYear,
      maxCompanies: 1,
    }
  }

  return {
    planId,
    isActive: true,
    maxUsers: plan.users + extraUsers,
    maxDocs: plan.docsPerYear + extraDocs * ADDONS.extraDocs.docs,
    maxCompanies: PAID_BASE_COMPANIES + extraCompanies,
  }
}
