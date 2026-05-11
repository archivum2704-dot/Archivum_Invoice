/**
 * Archivum — Pricing constants (mobile mirror of apps/web/lib/pricing.ts)
 * Keep in sync with the web version.
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Gratuito",
    price: 0,
    priceLabel: "0 €",
    docsPerMonth: 20,
    users: 1,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 14.99,
    priceLabel: "14,99 €/mes",
    docsPerMonth: 200,
    users: 1,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 24.99,
    priceLabel: "24,99 €/mes",
    docsPerMonth: 500,
    users: 1,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const ADDONS = {
  extraDocs: {
    label: "Bono 200 documentos extra",
    price: 9.99,
    docs: 200,
  },
  extraUser: {
    label: "Usuario adicional",
    price: 4.99,
  },
  extraCompany: {
    label: "Empresa adicional",
    price: 4.99,
  },
} as const;
