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
