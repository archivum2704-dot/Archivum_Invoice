/**
 * Monedas admitidas en presupuestos, albaranes y facturas.
 *
 * VeriFactu no tiene campo de moneda: lo que se registra, se encadena en la
 * huella y se remite a la AEAT es siempre en euros (ver lib/verifactu.ts).
 * `exchangeRate` es el tipo de cambio manual que lo hace posible — euros por
 * 1 unidad de la moneda extranjera, tal y como lo introduce el usuario — y es
 * obligatorio por el RD 1619/2012 (art. 6.1.j) en cuanto la moneda no es EUR.
 */

export interface CurrencyDef {
  code: string
  symbol: string
  label: string
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'USD', symbol: '$', label: 'Dólar estadounidense' },
  { code: 'GBP', symbol: '£', label: 'Libra esterlina' },
]

export const DEFAULT_CURRENCY = 'EUR'

export function isValidCurrency(code: string): boolean {
  return CURRENCIES.some(c => c.code === code)
}

export function currencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code
}

/** EUR no necesita tipo de cambio; cualquier otra moneda sí. */
export function needsExchangeRate(code: string): boolean {
  return code !== DEFAULT_CURRENCY
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Equivalente en euros de un importe en `currency`, para lo que viaja a la
 * AEAT. `exchangeRate` son los euros que vale 1 unidad de `currency`.
 */
export function toEur(amount: number, currency: string, exchangeRate?: number | null): number {
  if (currency === DEFAULT_CURRENCY) return round2(amount)
  return round2((Number(amount) || 0) * (Number(exchangeRate) || 0))
}

/** "1.234,56 €" para EUR; "$1234.56" para el resto. */
export function formatMoney(amount: number, currency: string): string {
  const symbol = currencySymbol(currency)
  const n = (Number(amount) || 0).toFixed(2)
  return currency === DEFAULT_CURRENCY ? `${n.replace('.', ',')} ${symbol}` : `${symbol}${n}`
}
