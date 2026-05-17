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
    docsPerYear: 250,
    storageGB: 0.5,
    users: 1,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 14.99,
    priceLabel: "14,99 €/mes",
    docsPerMonth: 75,
    docsPerYear: 900,
    storageGB: 1.8,
    users: 2,
  },
  business: {
    id: "business",
    name: "Business",
    price: 19.99,
    priceLabel: "19,99 €/mes",
    docsPerMonth: 200,
    docsPerYear: 2400,
    storageGB: 4.8,
    users: 2,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 24.99,
    priceLabel: "24,99 €/mes",
    docsPerMonth: 450,
    docsPerYear: 5400,
    storageGB: 10.8,
    users: 2,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const ADDONS = {
  extraDocs: {
    label: "Bono 250 documentos extra",
    sublabel: "Pago único · sin caducidad",
    price: 4.99,
    docs: 250,
  },
  extraUser: {
    label: "Usuario adicional (miembro)",
    sublabel: "Por usuario / mes",
    price: 4.99,
  },
} as const;
