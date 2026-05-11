/**
 * Archivum — Pricing constants (single source of truth)
 *
 * Planes base:
 *   free    →  0 €/mes  · 1 usuario · 20  docs/mes (acumulativos)
 *   starter → 14,99 €/mes · 1 usuario · 200 docs/mes (acumulativos)
 *   pro     → 24,99 €/mes · 1 usuario · 500 docs/mes (acumulativos)
 *
 * Add-ons:
 *   Bono 200 docs extra → 9,99 € (pago único, sin caducidad)
 *   Usuario extra       → 4,99 €/mes
 *   Empresa extra       → 4,99 €/mes
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Gratuito",
    price: 0,
    priceLabel: "0 €",
    priceSuffix: "para siempre",
    docsPerMonth: 20,
    users: 1,
    highlight: false,
    badge: null,
    description: "Para empezar a ordenar tu documentación sin coste.",
    features: [
      "1 usuario incluido",
      "20 documentos/mes (acumulativos)",
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
    docsPerMonth: 200,
    users: 1,
    highlight: false,
    badge: null,
    description: "Para autónomos y pequeños negocios con más volumen.",
    features: [
      "1 usuario incluido",
      "200 documentos/mes (acumulativos)",
      "Todo lo del plan Gratuito",
      "Usuarios extra: 4,99 €/mes c/u",
      "Empresas extra: 4,99 €/mes c/u",
      "Bono 200 docs adicionales: 9,99 €",
      "Soporte por correo",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 24.99,
    priceLabel: "24,99 €",
    priceSuffix: "/ mes",
    docsPerMonth: 500,
    users: 1,
    highlight: true,
    badge: "MÁS POPULAR",
    description: "Para pymes con alto volumen documental y múltiples empresas.",
    features: [
      "1 usuario incluido",
      "500 documentos/mes (acumulativos)",
      "Todo lo del plan Starter",
      "Usuarios extra: 4,99 €/mes c/u",
      "Empresas extra: 4,99 €/mes c/u",
      "Bono 200 docs adicionales: 9,99 €",
      "Soporte prioritario",
    ],
  },
} as const

export type PlanId = keyof typeof PLANS

/** Add-ons (precios fijos) */
export const ADDONS = {
  extraDocs: {
    label: "Bono 200 documentos extra",
    sublabel: "Pago único · sin caducidad",
    price: 9.99,
    priceLabel: "9,99 €",
    docs: 200,
  },
  extraUser: {
    label: "Usuario adicional",
    sublabel: "Por usuario / mes",
    price: 4.99,
    priceLabel: "4,99 €/mes",
  },
  extraCompany: {
    label: "Empresa adicional",
    sublabel: "Por empresa / mes",
    price: 4.99,
    priceLabel: "4,99 €/mes",
  },
} as const

/** FAQ entries shown in pricing sections */
export const PRICING_FAQ = [
  {
    q: "¿Los documentos no usados del mes se pierden?",
    a: "No. La cuota no consumida se acumula al mes siguiente. Si tienes 200 docs/mes y solo subes 150, el próximo mes podrás subir 250.",
  },
  {
    q: "¿El bono de documentos extra caduca?",
    a: "No. Los 200 documentos del bono no tienen fecha de caducidad. Se descuentan a medida que los vas usando.",
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
