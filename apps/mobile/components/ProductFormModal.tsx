import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from "react-native";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { KeyboardModal } from "@/components/KeyboardModal";
import { Button, Input } from "@/components/ui";
import { randomId } from "@/lib/random-id";

export interface FormProduct {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  unit_price: number;
  tax_rate: number;
  track_stock: boolean;
  stock_qty: number;
  min_stock: number | null;
}

type Draft = {
  name: string; sku: string; category: string; unit: string;
  unit_price: string; tax_rate: string; track_stock: boolean; stock_qty: string; min_stock: string;
};

const EMPTY: Draft = { name: "", sku: "", category: "", unit: "ud", unit_price: "0", tax_rate: "21", track_stock: true, stock_qty: "0", min_stock: "" };

const toDraft = (p: FormProduct): Draft => ({
  name: p.name, sku: p.sku ?? "", category: p.category ?? "", unit: p.unit,
  unit_price: String(p.unit_price), tax_rate: String(p.tax_rate), track_stock: p.track_stock,
  stock_qty: String(p.stock_qty), min_stock: p.min_stock == null ? "" : String(p.min_stock),
});

/**
 * Create or edit a product. Espejo de `apps/web/components/product-form-modal.tsx`.
 *
 * Inventario and the invoice form both use it — the invoice so a product can
 * be added without abandoning a half-written invoice, the same way a client
 * can. One component so the two cannot drift apart.
 */
export function ProductFormModal({ visible, orgId, product, products, initial, onSaved, onClose }: {
  visible: boolean;
  orgId: string | null;
  /** Product to edit; omit to create a new one. */
  product?: FormProduct | null;
  /** Existing catalogue — for the next automatic reference. */
  products: { sku: string | null }[];
  /** Pre-fills a new product (e.g. from what was typed in an invoice line). */
  initial?: Partial<Pick<Draft, "name" | "unit_price" | "tax_rate">>;
  /** Receives the saved product so the caller can select it. */
  onSaved: (product: FormProduct) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const C = useColors();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Reset every time the sheet opens, from the product or the pre-fill.
  useEffect(() => {
    if (!visible) return;
    setDraft(product ? toDraft(product) : { ...EMPTY, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, product?.id]);

  // Next free auto reference (REF-0001, REF-0002…) based on existing products
  const nextAutoSku = () => {
    let max = 0;
    for (const p of products) {
      const m = /^REF-(\d+)$/i.exec(p.sku?.trim() ?? "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `REF-${String(max + 1).padStart(4, "0")}`;
  };

  const save = async () => {
    if (!draft.name.trim() || !orgId) return;
    setSaving(true);
    const payload = {
      organization_id: orgId,
      name: draft.name.trim(),
      sku: draft.sku.trim() || nextAutoSku(),
      category: draft.category.trim() || null,
      unit: draft.unit.trim() || "ud",
      unit_price: Number(draft.unit_price.replace(",", ".")) || 0,
      tax_rate: Number(draft.tax_rate.replace(",", ".")) || 0,
      track_stock: draft.track_stock,
      stock_qty: draft.track_stock ? Number(draft.stock_qty) || 0 : 0,
      // Blank means "not watched" — distinct from a floor of 0, which would
      // only ever warn once the product had already run out.
      min_stock: draft.track_stock && draft.min_stock.trim() !== ""
        ? Number(draft.min_stock) || 0
        : null,
    };
    // The id is generated here so the caller can select the new product
    // straight away without reading the row back.
    const id = product?.id ?? randomId();
    const res = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert({ id, ...payload });
    setSaving(false);
    if (res.error) { Alert.alert(t("common.error"), res.error.message); return; }
    onSaved({ id, ...payload });
    onClose();
  };

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl - 4, maxHeight: "88%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text }}>{product ? t("inventory.edit") : t("inventory.new")}</Text>
            <TouchableOpacity onPress={onClose}><X size={22} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ gap: spacing.md }}>
              <Input label={t("inventory.name")} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} />
              <Input label="Referencia" value={draft.sku} onChangeText={(v) => setDraft({ ...draft, sku: v })} />
              <Input label={t("inventory.category")} value={draft.category} onChangeText={(v) => setDraft({ ...draft, category: v })} placeholder={t("inventory.categoryPlaceholder")} />
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Input label={`${t("inventory.price")} (€)`} value={draft.unit_price} onChangeText={(v) => setDraft({ ...draft, unit_price: v })} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label={`${t("inventory.iva")} (%)`} value={draft.tax_rate} onChangeText={(v) => setDraft({ ...draft, tax_rate: v })} keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: C.text }}>{t("inventory.trackStock")}</Text>
                <Switch value={draft.track_stock} onValueChange={(v) => setDraft({ ...draft, track_stock: v })} trackColor={{ false: C.border, true: C.blueMed }} thumbColor={C.surface} />
              </View>
              {draft.track_stock && (
                <>
                  <Input label={t("inventory.stock")} value={draft.stock_qty} onChangeText={(v) => setDraft({ ...draft, stock_qty: v })} keyboardType="number-pad" />
                  <Input
                    label={t("inventory.minStock")}
                    value={draft.min_stock}
                    onChangeText={(v) => setDraft({ ...draft, min_stock: v })}
                    keyboardType="number-pad"
                    placeholder={t("inventory.minStockPlaceholder")}
                    hint={t("inventory.minStockHint")}
                  />
                </>
              )}
            </View>
          </ScrollView>
          <Button
            label={t("common.save")}
            onPress={save}
            disabled={saving || !draft.name.trim()}
            loading={saving}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    </KeyboardModal>
  );
}
