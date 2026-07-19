import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, Modal, ScrollView, Switch, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { Plus, Package, X, Pencil, Trash2, Lock, ArrowLeft, Search, FileSpreadsheet } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { APP_URL } from "@/lib/config";


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
}

type Draft = {
  id?: string;
  name: string; sku: string; category: string; unit: string;
  unit_price: string; tax_rate: string; track_stock: boolean; stock_qty: string;
};

const EMPTY: Draft = { name: "", sku: "", category: "", unit: "ud", unit_price: "0", tax_rate: "21", track_stock: true, stock_qty: "0" };

// Sentinel for the "uncategorized" filter chip
const UNCAT = "__uncategorized__";

export default function InventarioScreen() {
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
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} /></TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: "700", color: C.text }}>{t("inventory.title")}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {paid && products.length > 0 && (
          <TouchableOpacity onPress={exportExcel} disabled={exporting}
            style={{ borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 9, borderRadius: 12, opacity: exporting ? 0.5 : 1 }}>
            {exporting ? <ActivityIndicator size="small" color={C.blue} /> : <FileSpreadsheet size={16} color={C.text} />}
          </TouchableOpacity>
        )}
        {canManage && (
          <TouchableOpacity onPress={() => { setDraft(EMPTY); setModal(true); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.blue, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 }}>
            <Plus size={16} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>{t("inventory.new")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (!paid) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        {Header}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Lock size={26} color={C.blue} />
          </View>
          <Text style={{ fontSize: 17, fontWeight: "600", color: C.text, textAlign: "center" }}>{t("inventory.paywallTitle")}</Text>
          <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", marginTop: 8 }}>{t("inventory.paywallBody")}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`${APP_URL}/configuracion/billing`)}
            style={{ marginTop: 20, backgroundColor: C.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>{t("inventory.upgrade")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {Header}

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12 }}>
          <Search size={16} color={C.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("common.search")}
            placeholderTextColor={C.muted}
            style={{ flex: 1, paddingVertical: 10, color: C.text, fontSize: 15 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}><X size={16} color={C.muted} /></TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <View style={{ paddingBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
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

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.blue} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Package size={40} color={C.muted} />
              <Text style={{ color: C.muted, marginTop: 12 }}>{products.length === 0 ? t("inventory.empty") : t("inventory.noResults")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {fmtEur(item.unit_price)} · {Number(item.tax_rate)}% {t("inventory.iva")}
                  {item.track_stock ? ` · ${t("inventory.stock")}: ${Number(item.stock_qty)}` : ""}
                </Text>
                {item.category ? (
                  <View style={{ alignSelf: "flex-start", marginTop: 4, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: "500", color: C.muted }}>{item.category}</Text>
                  </View>
                ) : null}
              </View>
              {canManage && (
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <TouchableOpacity onPress={() => { setDraft({ id: item.id, name: item.name, sku: item.sku ?? "", category: item.category ?? "", unit: item.unit, unit_price: String(item.unit_price), tax_rate: String(item.tax_rate), track_stock: item.track_stock, stock_qty: String(item.stock_qty) }); setModal(true); }} style={{ padding: 6 }}>
                    <Pencil size={16} color={C.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(item)} style={{ padding: 6 }}><Trash2 size={16} color={C.red} /></TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Create / edit modal */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "88%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{draft.id ? t("inventory.edit") : t("inventory.new")}</Text>
              <TouchableOpacity onPress={() => setModal(false)}><X size={22} color={C.muted} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Field label={t("inventory.name")} C={C}><Input value={draft.name} onChangeText={(v: string) => setDraft({ ...draft, name: v })} C={C} /></Field>
              <Field label="Referencia" C={C}><Input value={draft.sku} onChangeText={(v: string) => setDraft({ ...draft, sku: v })} C={C} /></Field>
              <Field label={t("inventory.category")} C={C}><Input value={draft.category} onChangeText={(v: string) => setDraft({ ...draft, category: v })} placeholder={t("inventory.categoryPlaceholder")} C={C} /></Field>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><Field label={`${t("inventory.price")} (€)`} C={C}><Input value={draft.unit_price} onChangeText={(v: string) => setDraft({ ...draft, unit_price: v })} keyboardType="decimal-pad" C={C} /></Field></View>
                <View style={{ flex: 1 }}><Field label={`${t("inventory.iva")} (%)`} C={C}><Input value={draft.tax_rate} onChangeText={(v: string) => setDraft({ ...draft, tax_rate: v })} keyboardType="decimal-pad" C={C} /></Field></View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 10 }}>
                <Text style={{ color: C.text, fontSize: 14 }}>{t("inventory.trackStock")}</Text>
                <Switch value={draft.track_stock} onValueChange={(v: boolean) => setDraft({ ...draft, track_stock: v })} />
              </View>
              {draft.track_stock && <Field label={t("inventory.stock")} C={C}><Input value={draft.stock_qty} onChangeText={(v: string) => setDraft({ ...draft, stock_qty: v })} keyboardType="number-pad" C={C} /></Field>}
            </ScrollView>
            <TouchableOpacity onPress={save} disabled={saving || !draft.name.trim()}
              style={{ backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 12, opacity: saving || !draft.name.trim() ? 0.5 : 1 }}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, C }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
        backgroundColor: active ? C.blue : C.surface, borderColor: active ? C.blue : C.border,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#fff" : C.muted }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, children, C }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}
function Input({ C, ...props }: any) {
  return <TextInput {...props} placeholderTextColor={C.muted}
    style={{ backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 15 }} />;
}
