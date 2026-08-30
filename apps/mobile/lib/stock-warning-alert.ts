import { Alert } from "react-native";
import type { StockWarning } from "./stock";

/**
 * Native confirmation for a set of stock-below-minimum warnings, shared by
 * every screen that can issue an invoice (Albaranes, a delivery note's
 * detail, and Facturación directa). Purely a UI helper around getStockWarnings
 * — it decides nothing, it just asks.
 */
export function confirmStockWarnings(
  t: (key: string, opts?: Record<string, unknown>) => string,
  warnings: StockWarning[],
  onConfirm: () => void,
) {
  const body = [
    warnings.length === 1 ? t("stockWarning.bodyOne") : t("stockWarning.bodyMany"),
    "",
    ...warnings.map(w => t("stockWarning.line", {
      name: w.name, current: w.currentStock, qty: w.quantity, after: w.afterStock, unit: w.unit, min: w.minStock,
    })),
  ].join("\n");

  Alert.alert(t("stockWarning.title"), body, [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("stockWarning.confirm"), onPress: onConfirm },
  ]);
}
