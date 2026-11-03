import type Stripe from 'stripe'

/**
 * IVA del 21 % sobre las suscripciones (decisión del 3 de noviembre de 2026).
 *
 * Los precios se publican sin IVA (aviso legal, apartado 15), pero hasta
 * ahora Stripe cobraba exactamente el precio publicado: no había ningún
 * impuesto configurado. Se usa un tipo fijo y no Stripe Tax, por decisión del
 * cliente (sin coste por transacción); no distingue clientes de otros países.
 *
 * El TaxRate se busca en Stripe por su metadata y, si no existe, se crea, así
 * que no hace falta darlo de alta a mano. `STRIPE_IVA_TAX_RATE_ID` permite
 * fijar uno concreto.
 */
const MARK = 'archivum_iva_21'
let cached: string | null = null

export async function getIvaTaxRateId(stripe: Stripe): Promise<string> {
  if (process.env.STRIPE_IVA_TAX_RATE_ID) return process.env.STRIPE_IVA_TAX_RATE_ID
  if (cached) return cached

  for await (const rate of stripe.taxRates.list({ active: true, limit: 100 })) {
    if (rate.metadata?.[MARK] === '1' && rate.percentage === 21 && !rate.inclusive) {
      cached = rate.id
      return rate.id
    }
  }

  const created = await stripe.taxRates.create({
    display_name: 'IVA',
    description: 'IVA 21 % (Archivum)',
    percentage: 21,
    inclusive: false,      // el precio publicado es la base; el IVA se suma
    country: 'ES',
    jurisdiction: 'ES',
    tax_type: 'vat',
    metadata: { [MARK]: '1' },
  })
  cached = created.id
  return created.id
}

/** Whether a subscription is already being charged IVA (new subscriptions are). */
export function subscriptionHasIva(sub: Stripe.Subscription): boolean {
  if (sub.default_tax_rates?.length) return true
  return sub.items.data.some(i => (i.tax_rates?.length ?? 0) > 0)
}
