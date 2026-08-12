import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView, Switch, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { Plus, Package, X, Pencil, Trash2, Lock, ArrowLeft, Search, FileSpreadsheet, AlertTriangle } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { BillingNotice } from "@/components/BillingNotice";
import { RequirePermission } from "@/components/RequirePermission";
import { KeyboardModal } from "@/components/KeyboardModal";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui";



interface Product {
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
  id?: string;
  name: string; sku: string; category: string; unit: string;
  unit_price: string; tax_rate: string; track_stock: boolean; stock_qty: string; min_stock: string;
};

const EMPTY: Draft = { name: "", sku: "", category: "", unit: "ud", unit_price: "0", tax_rate: "21", track_stock: true, stock_qty: "0", min_stock: "" };

/**
 * A tracked product at or below its reorder floor.
 *
 * Only products with a floor set are watched: a null min_stock means nobody
 * asked to be warned, and warning anyway would make the flag noise.
 */
function isLowStock(p: Product) {
  return p.track_stock && p.min_stock != null && Number(p.stock_qty) <= Number(p.min_stock);
}

// Sentinel for the "uncategorized" filter chip
const UNCAT = "__uncategorized__";

function InventarioScreenContent() {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId, isAdmin, isPaid, isPlatformAdmin } = useAuth();
  const paid = isPaid || isPlatformAdmin;
  const canManage = isAdmin && paid;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const categories = Array.from(
    new Set(products.map((p) => p.category?.trim()).filter((c): c is string => !!c))
  ).sort((a, b) => a.localeCompare(b));
  const hasUncategorized = products.some((p) => !p.category?.trim());
  const lowStock = products.filter(isLowStock);
  const q = search.trim().toLowerCase();
  const filtered = products.filter((p) => {
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q);
    const matchesCategory =
      !selectedCategory ||
      (selectedCategory === UNCAT ? !p.category?.trim() : p.category?.trim() === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const fmtEur = (n: number) => `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const load = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("products").select("*").eq("organization_id", orgId).eq("is_active", true).order("name");
    setProducts((data as Product[]) ?? []);
    setLoading(false); setRefreshing(false);
  }, [orgId]);

  useEffect(() => { if (paid) load(); else setLoading(false); }, [load, paid]);

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
      unit_price: Number(draft.unit_price) || 0,
      tax_rate: Number(draft.tax_rate) || 0,
      track_stock: draft.track_stock,
      stock_qty: draft.track_stock ? Number(draft.stock_qty) || 0 : 0,
      // Blank means "not watched" — distinct from a floor of 0, which would
      // only ever warn once the product had already run out.
      min_stock: draft.track_stock && draft.min_stock.trim() !== ""
        ? Number(draft.min_stock) || 0
        : null,
    };
    const res = draft.id
      ? await supabase.from("products").update(payload).eq("id", draft.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (res.error) { Alert.alert(t("common.error"), res.error.message); return; }
    setModal(false); setDraft(EMPTY); load();
  };

  const exportExcel = async () => {
    if (filtered.length === 0) return;
    setExporting(true);
    try {
      const rows = filtered.map(p => ({
        [t("inventory.name")]: p.name,
        Referencia: p.sku ?? "",
        [t("inventory.category")]: p.category ?? "",
        [t("inventory.price")]: Number(p.unit_price),
        [`${t("inventory.iva")} (%)`]: Number(p.tax_rate),
        [t("inventory.stock")]: p.track_stock ? Number(p.stock_qty) : null,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t("inventory.title"));
      const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const uri = FileSystem.cacheDirectory + `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: "base64" });
      await Sharing.shareAsync(uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    } catch (e) {
      Alert.alert(t("common.error"), String(e));
    }
    setExporting(false);
  };

  const remove = (p: Product) => {
    Alert.alert(t("inventory.deleteTitle"), t("inventory.deleteConfirm", { name: p.name }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: async () => {
        await supabase.from("products").update({ is_active: false }).eq("id", p.id); load();
      } },
    ]);
  };

  const Header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} strokeWidth={1.75} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text }}>{t("inventory.title")}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {paid && products.length > 0 && (
          <TouchableOpacity onPress={exportExcel} disabled={exporting}
            style={{ borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: spacing.sm + 1, borderRadius: radius.md, opacity: exporting ? 0.5 : 1 }}>
            {exporting ? <ActivityIndicator size="small" color={C.blue} /> : <FileSpreadsheet size={16} color={C.text} strokeWidth={1.75} />}
          </TouchableOpacity>
        )}
        {canManage && (
          <Button
            label={t("inventory.new")}
            onPress={() => { setDraft(EMPTY); setModal(true); }}
            size="md"
            fullWidth={false}
            icon={<Plus size={16} color="#fff" strokeWidth={1.75} />}
          />
        )}
      </View>
    </View>
  );

  if (!paid) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        {Header}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
            <Lock size={26} color={C.blue} strokeWidth={1.75} />
          </View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: C.text, textAlign: "center" }}>{t("inventory.paywallTitle")}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted, textAlign: "center", marginTop: spacing.sm }}>{t("inventory.paywallBody")}</Text>
          <BillingNotice style={{ marginTop: spacing.xl - 4 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {Header}

      {/* Search */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
          <Search size={16} color={C.muted} strokeWidth={1.75} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("common.search")}
            placeholderTextColor={C.muted}
            style={{ flex: 1, paddingVertical: spacing.sm + 2, color: C.text, fontFamily: fonts.regular, fontSize: 15 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}><X size={16} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <View style={{ paddingBottom: spacing.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 6 }}>
            <Chip label={t("inventory.allCategories")} active={selectedCategory === null} onPress={() => setSelectedCategory(null)} C={C} />
            {categories.map((c) => (
              <Chip key={c} label={c} active={selectedCategory === c} onPress={() => setSelectedCategory(c)} C={C} />
            ))}
            {hasUncategorized && (
              <Chip label={t("inventory.uncategorized")} active={selectedCategory === UNCAT} onPress={() => setSelectedCategory(UNCAT)} C={C} />
            )}
          </ScrollView>
        </View>
      )}

      {/* Products that have fallen to their floor. A banner, because the per-row
          mark is easy to miss — the point of a minimum is that someone notices
          without going looking. */}
      {lowStock.length > 0 && (
        <View style={{
          flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
          backgroundColor: C.yellowL, borderWidth: 1, borderColor: C.yellow,
          borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
          marginHorizontal: spacing.lg, marginBottom: spacing.md,
        }}>
          <AlertTriangle size={16} color={C.yellow} strokeWidth={1.75} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: C.yellow }}>
              {t("inventory.lowStockTitle", { count: lowStock.length })}
            </Text>
            <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: 2 }}>
              {lowStock.slice(0, 4).map((p) => `${p.name} (${Number(p.stock_qty)}/${Number(p.min_stock)})`).join(" · ")}
              {lowStock.length > 4 ? ` · +${lowStock.length - 4}` : ""}
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm + 2 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.blue} />}
          ListEmptyComponent={
            <View style={{ paddingTop: spacing.xxl }}>
              <EmptyState
                icon={<Package size={28} color={C.muted} strokeWidth={1.5} />}
                title={products.length === 0 ? t("inventory.empty") : t("inventory.noResults")}
              />
            </View>
          }
          renderItem={({ item }) => {
            const lowStockItem = isLowStock(item);
            return (
              <Card
                style={{
                  flexDirection: "row", alignItems: "center", gap: spacing.md,
                  borderLeftWidth: lowStockItem ? 3 : 0,
                  borderLeftColor: lowStockItem ? C.yellow : "transparent",
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: C.text }}>{item.name}</Text>
                    {lowStockItem && <Badge label={t("inventory.lowStockBadge")} tone="yellow" />}
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {fmtEur(item.unit_price)} · {Number(item.tax_rate)}% {t("inventory.iva")}
                    {item.track_stock
                      ? ` · ${t("inventory.stock")}: ${Number(item.stock_qty)}${item.min_stock != null ? `/${Number(item.min_stock)}` : ""}`
                      : ""}
                  </Text>
                  {item.category ? (
                    <View style={{ alignSelf: "flex-start", marginTop: spacing.xs, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: C.muted }}>{item.category}</Text>
                    </View>
                  ) : null}
                </View>
                {canManage && (
                  <View style={{ flexDirection: "row", gap: spacing.xs }}>
                    <TouchableOpacity onPress={() => { setDraft({ id: item.id, name: item.name, sku: item.sku ?? "", category: item.category ?? "", unit: item.unit, unit_price: String(item.unit_price), tax_rate: String(item.tax_rate), track_stock: item.track_stock, stock_qty: String(item.stock_qty), min_stock: item.min_stock == null ? "" : String(item.min_stock) }); setModal(true); }} style={{ padding: 6 }}>
                      <Pencil size={16} color={C.muted} strokeWidth={1.75} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => remove(item)} style={{ padding: 6 }}><Trash2 size={16} color={C.red} strokeWidth={1.75} /></TouchableOpacity>
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}

      {/* Create / edit modal */}
      <KeyboardModal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl - 4, maxHeight: "88%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text }}>{draft.id ? t("inventory.edit") : t("inventory.new")}</Text>
              <TouchableOpacity onPress={() => setModal(false)}><X size={22} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
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
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, C }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md + 2, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1,
        backgroundColor: active ? C.blue : C.surface, borderColor: active ? C.blue : C.border,
      }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: active ? "#fff" : C.muted }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function InventarioScreen() {
  return (
    <RequirePermission section="inventario">
      <InventarioScreenContent />
    </RequirePermission>
  );
}
