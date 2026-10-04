import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { Plus, Trash2, Package, PackagePlus, ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { Card } from "@/components/ui";
import { ProductPickerModal } from "@/components/ProductPickerModal";
import { ProductFormModal, type FormProduct } from "@/components/ProductFormModal";
import {
  type PurchaseLine, emptyPurchaseLine, lineBase, purchaseTotals,
} from "@/lib/purchase-lines";

type Product = { id: string; name: string; sku: string | null; tax_rate: number; track_stock: boolean };

const VAT_RATES = ["0", "4", "5", "10", "21"];

const fmt = (n: number, currency: string) =>
  `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

/**
 * Líneas de una factura de compra. Espejo de
 * `apps/web/components/purchase-lines-editor.tsx`: cada línea puede ir
 * enlazada a un producto, y al guardar la factura la base de datos suma su
 * cantidad al stock (ver lib/purchase-lines.ts). Lo usan Subir y Editar.
 */
export function PurchaseLinesEditor({ lines, onChange, currency = "EUR" }: {
  lines: PurchaseLine[];
  onChange: (lines: PurchaseLine[]) => void;
  currency?: string;
}) {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId, isAdmin, isPaid, isPlatformAdmin } = useAuth();
  const canCreateProduct = isAdmin && (isPaid || isPlatformAdmin);

  const [products, setProducts] = useState<Product[]>([]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [formIndex, setFormIndex] = useState<number | null>(null);

  const loadProducts = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("products")
      .select("id, name, sku, tax_rate, track_stock")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name");
    setProducts((data as Product[]) ?? []);
  }, [orgId]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const setLine = (i: number, patch: Partial<PurchaseLine>) =>
    onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  // El precio del producto es el de VENTA; el de compra lo pone el proveedor,
  // así que solo se rellena la descripción y el IVA.
  const pickProduct = (i: number, p: Product) =>
    setLine(i, { productId: p.id, description: p.name, taxRate: String(Number(p.tax_rate)) });

  const onProductCreated = (p: FormProduct) => {
    setProducts(prev => [...prev, { id: p.id, name: p.name, sku: p.sku, tax_rate: p.tax_rate, track_stock: p.track_stock }]
      .sort((a, b) => a.name.localeCompare(b.name)));
    if (formIndex !== null) {
      setLine(formIndex, {
        productId: p.id,
        description: lines[formIndex]?.description.trim() || p.name,
        taxRate: String(Number(p.tax_rate)),
      });
    }
  };

  const totals = purchaseTotals(lines);
  const inputStyle = {
    fontFamily: fonts.regular, fontSize: 14, color: C.text, backgroundColor: C.inputBg,
    borderWidth: 1, borderColor: C.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 8,
  } as const;
  const smallLabel = { fontFamily: fonts.medium, fontSize: 11, color: C.muted, marginBottom: 4 } as const;

  return (
    <Card style={{ gap: spacing.md }}>
      <View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: C.text }}>{t("purchaseLines.title")}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 17 }}>{t("purchaseLines.hint")}</Text>
      </View>

      {lines.map((l, i) => {
        const product = products.find(p => p.id === l.productId);
        return (
          <View key={i} style={{ gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <TouchableOpacity onPress={() => setPickerIndex(i)}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, ...inputStyle }}>
                <Package size={15} color={product ? C.blue : C.muted} strokeWidth={1.75} />
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: product ? C.text : C.muted }}>
                  {product?.name ?? t("purchaseLines.pickProduct")}
                </Text>
                <ChevronDown size={14} color={C.muted} strokeWidth={1.75} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onChange(lines.filter((_, j) => j !== i))} hitSlop={8}
                accessibilityLabel={t("purchaseLines.removeLine")}>
                <Trash2 size={18} color={C.red} strokeWidth={1.75} />
              </TouchableOpacity>
            </View>

            {l.productId ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>
                  {product?.track_stock ? t("purchaseLines.addsStock") : t("purchaseLines.noStockTracking")}
                </Text>
                <TouchableOpacity onPress={() => setLine(i, { productId: null })}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: C.blue }}>{t("purchaseLines.unlink")}</Text>
                </TouchableOpacity>
              </View>
            ) : canCreateProduct ? (
              <TouchableOpacity onPress={() => setFormIndex(i)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <PackagePlus size={13} color={C.blue} strokeWidth={1.75} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: C.blue }}>{t("purchaseLines.newProduct")}</Text>
              </TouchableOpacity>
            ) : null}

            <TextInput style={inputStyle} placeholder={t("purchaseLines.description")} placeholderTextColor={C.muted}
              value={l.description} onChangeText={v => setLine(i, { description: v })} />

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={smallLabel}>{t("purchaseLines.quantity")}</Text>
                <TextInput style={inputStyle} keyboardType="decimal-pad" placeholder="1" placeholderTextColor={C.muted}
                  value={l.quantity} onChangeText={v => setLine(i, { quantity: v })} />
              </View>
              <View style={{ flex: 1.3 }}>
                <Text style={smallLabel}>{t("purchaseLines.unitCost")}</Text>
                <TextInput style={inputStyle} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={C.muted}
                  value={l.unitPrice} onChangeText={v => setLine(i, { unitPrice: v })} />
              </View>
              <View style={{ flex: 1.3, alignItems: "flex-end", justifyContent: "flex-end" }}>
                <Text style={smallLabel}>{t("purchaseLines.lineTotal")}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: C.text, paddingVertical: 8 }}>{fmt(lineBase(l), currency)}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ ...smallLabel, marginBottom: 0, marginRight: 2 }}>{t("purchaseLines.vat")}</Text>
              {VAT_RATES.map(r => {
                const on = l.taxRate === r;
                return (
                  <TouchableOpacity key={r} onPress={() => setLine(i, { taxRate: r })}
                    style={{ paddingHorizontal: spacing.sm + 2, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? C.blue : C.border, backgroundColor: on ? C.blue : C.surface }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: on ? "#fff" : C.muted }}>{r}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      <TouchableOpacity onPress={() => onChange([...lines, emptyPurchaseLine()])}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Plus size={15} color={C.blue} strokeWidth={1.75} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.blue }}>{t("purchaseLines.addLine")}</Text>
      </TouchableOpacity>

      {lines.length > 0 && (
        <View style={{ gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: C.border }}>
          {([
            [t("purchaseLines.subtotal"), totals.subtotal, false],
            [t("purchaseLines.vatTotal"), totals.tax, false],
            [t("purchaseLines.total"), totals.total, true],
          ] as const).map(([label, value, bold]) => (
            <View key={label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: bold ? fonts.bold : fonts.regular, fontSize: 13, color: bold ? C.text : C.muted }}>{label}</Text>
              <Text style={{ fontFamily: bold ? fonts.bold : fonts.medium, fontSize: 13, color: C.text }}>{fmt(value, currency)}</Text>
            </View>
          ))}
        </View>
      )}

      <ProductPickerModal
        visible={pickerIndex !== null}
        products={products}
        onPick={(p) => { if (pickerIndex !== null) pickProduct(pickerIndex, p); }}
        onClose={() => setPickerIndex(null)}
      />
      <ProductFormModal
        visible={formIndex !== null}
        orgId={orgId}
        products={products}
        initial={formIndex !== null ? {
          name: lines[formIndex]?.description.trim() ?? "",
          tax_rate: lines[formIndex]?.taxRate || "21",
        } : undefined}
        onSaved={onProductCreated}
        onClose={() => setFormIndex(null)}
      />
    </Card>
  );
}
