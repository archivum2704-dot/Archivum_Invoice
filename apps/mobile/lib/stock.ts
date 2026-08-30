/**
 * A tracked product at or below its reorder floor.
 *
 * Only products with a floor set are watched: a null min_stock means nobody
 * asked to be warned, and warning anyway would make the flag noise.
 *
 * Mirrors apps/web/lib/stock.ts — keep both in sync.
 */
export function isLowStock(p: { track_stock: boolean; stock_qty: number; min_stock: number | null }) {
  return p.track_stock && p.min_stock != null && Number(p.stock_qty) <= Number(p.min_stock);
}

export interface StockWarning {
  productId: string;
  name: string;
  unit: string;
  currentStock: number;
  quantity: number;
  afterStock: number;
  minStock: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Products whose stock would drop to or below their reorder floor if these
 * lines were billed right now — same rule as isLowStock, applied to the
 * stock *after* the sale instead of the stock as it stands today. Used to
 * warn before issuing an invoice, not to block it: the caller decides
 * whether to go ahead once it sees the list.
 */
export function getStockWarnings(
  lines: { productId: string | null; quantity: number }[],
  products: { id: string; name: string; unit: string; track_stock: boolean; stock_qty: number; min_stock: number | null }[],
): StockWarning[] {
  const byId = new Map(products.map(p => [p.id, p]));
  const warnings: StockWarning[] = [];
  for (const line of lines) {
    if (!line.productId || !line.quantity) continue;
    const p = byId.get(line.productId);
    if (!p || !p.track_stock || p.min_stock == null) continue;
    const afterStock = round2(Number(p.stock_qty) - line.quantity);
    if (afterStock <= p.min_stock) {
      warnings.push({
        productId: p.id, name: p.name, unit: p.unit,
        currentStock: Number(p.stock_qty), quantity: line.quantity,
        afterStock, minStock: p.min_stock,
      });
    }
  }
  return warnings;
}
