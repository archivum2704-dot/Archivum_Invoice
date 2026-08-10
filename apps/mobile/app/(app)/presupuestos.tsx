import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Plus, ClipboardList, X, Trash2, Lock, ArrowLeft, ChevronRight,
  Search as SearchIcon, Download, Pencil, ArrowRight,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { BillingNotice } from "@/components/BillingNotice";
import { APP_URL } from "@/lib/config";
import { RequirePermission } from "@/components/RequirePermission";
import { KeyboardModal } from "@/components/KeyboardModal";
import { NewClientModal, type CreatedClient } from "@/components/NewClientModal";
import { DateField } from "@/components/DateField";
import { readJson } from "@/lib/api";
import { EXEMPTION_CAUSES, exemptionShort } from "@/lib/exemption-causes";

const IVA_RATES = ["", "4", "10", "21"];
const RET_RATES = ["", "7", "15", "19"];
const DISC_RATES = ["", "5", "10", "15", "20"];

interface Quote { id: string; full_number: string | null; client_name: string | null; total: number; status: string; issue_date: string | null; }
interface Company { id: string; name: string; cif: string | null; }
interface Product { id: string; name: string; unit_price: number; tax_rate: number; }
type Line = { productId: string | null; description: string; quantity: string; unitPrice: string; taxRate: string; exemptionCause: string };

const emptyLine = (): Line => ({ productId: null, description: "", quantity: "", unitPrice: "", taxRate: "21", exemptionCause: "" });
/** A blank quantity means one unit, a blank price means zero — so both fields
 *  can show their placeholder instead of a pre-filled value the user has to
 *  clear before typing. */
const qtyOf   = (v: string) => (v.trim() === "" ? 1 : (Number(v) || 0));
const priceOf = (v: string) => (Number(v) || 0);

const r2 = (n: number) => Math.round(n * 100) / 100;

function PresupuestosScreenContent() {
  const { t } = useTranslation();
  const C = useColors();
  const { session, orgId, org, isAdmin, isPaid, isPlatformAdmin } = useAuth();
  const paid = isPaid || isPlatformAdmin;
  const canManage = isAdmin && paid;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [clientPicker, setClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [retentionPct, setRetentionPct] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const [newClientOpen, setNewClientOpen] = useState(false);

  const fmtEur = (n: number) => `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const selectedClient = companies.find(c => c.id === clientId);

  const clientMatches = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(c => c.name.toLowerCase().includes(q) || (c.cif ?? "").toLowerCase().includes(q));
  }, [companies, clientSearch]);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [{ data: q }, { data: co }, { data: pr }] = await Promise.all([
      supabase.from("quotes").select("id, full_number, client_name, total, status, issue_date").eq("organization_id", orgId).eq("kind", "quote").neq("status", "converted").order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name, cif").eq("organization_id", orgId).eq("is_active", true).order("name"),
      supabase.from("products").select("id, name, unit_price, tax_rate").eq("organization_id", orgId).eq("is_active", true).order("name"),
    ]);
    setQuotes((q as Quote[]) ?? []); setCompanies((co as Company[]) ?? []); setProducts((pr as Product[]) ?? []);
    setLoading(false); setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    let grossBase = 0, grossTax = 0;
    for (const l of lines) {
      const base = qtyOf(l.quantity) * priceOf(l.unitPrice);
      grossBase += base; grossTax += base * (Number(l.taxRate) || 0) / 100;
    }
    const disc = Number(discountPct) || 0;
    const discount = r2(grossBase * disc / 100);
    const netBase = r2(grossBase - discount);
    const tax = r2(grossTax * (1 - disc / 100));
    const ret = r2(netBase * (Number(retentionPct) || 0) / 100);
    return { subtotal: r2(grossBase), discount, tax, ret, total: r2(netBase + tax - ret) };
  }, [lines, retentionPct, discountPct]);

  const resetForm = () => {
    setEditId(null); setClientId(""); setRetentionPct(""); setDiscountPct("");
    setValidUntil(""); setNotes(""); setLines([emptyLine()]);
  };
  const setLine = (i: number, patch: Partial<Line>) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  // Numbers come back from Postgres as "21.00"; the VAT chips compare against
  // "21", so normalise or the product's own rate would not appear selected.
  const pickProduct = (i: number, p: Product) => setLine(i, {
    productId: p.id,
    description: p.name,
    unitPrice: String(Number(p.unit_price)),
    taxRate: String(Number(p.tax_rate)),
  });

  const onClientCreated = (c: CreatedClient) => {
    setCompanies(prev => [...prev, c as Company].sort((a, b) => a.name.localeCompare(b.name)));
    setClientId(c.id);
    setClientPicker(false);
  };

  const addToInventory = async (i: number) => {
    const l = lines[i];
    if (!l.description.trim() || !orgId) return;
    const { data, error } = await supabase.from("products").insert({
      organization_id: orgId, name: l.description.trim(), sku: `REF-${Date.now().toString().slice(-6)}`,
      unit: "ud", unit_price: Number(l.unitPrice) || 0, tax_rate: Number(l.taxRate) || 0, track_stock: false, stock_qty: 0,
    }).select("id, name, unit_price, tax_rate").single();
    if (error || !data) { Alert.alert(t("common.error"), error?.message ?? ""); return; }
    setProducts(prev => [...prev, data as Product].sort((a, b) => a.name.localeCompare(b.name)));
    setLine(i, { productId: (data as Product).id });
  };

  const openEdit = async (q: Quote) => {
    resetForm();
    const [{ data: quote }, { data: ql }] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", q.id).single(),
      supabase.from("quote_lines").select("*").eq("quote_id", q.id).order("position"),
    ]);
    if (!quote) return;
    setEditId(q.id);
    setClientId(quote.client_company_id ?? "");
    setValidUntil(quote.valid_until ?? "");
    setDiscountPct(quote.discount_pct != null ? String(quote.discount_pct) : "");
    setRetentionPct(quote.retention_pct != null ? String(quote.retention_pct) : "");
    setNotes(quote.notes ?? "");
    setLines((ql && ql.length) ? ql.map((l: any) => ({ productId: l.product_id, description: l.description, quantity: String(l.quantity), unitPrice: String(l.unit_price), taxRate: String(l.tax_rate), exemptionCause: l.exemption_cause ?? "" })) : [emptyLine()]);
    setModal(true);
  };

  const save = async () => {
    if (!clientId) { Alert.alert(t("common.error"), t("invoicing.errClient")); return; }
    if (!lines.some(l => l.description.trim())) { Alert.alert(t("common.error"), t("invoicing.errLines")); return; }
    setSaving(true);
    try {
      // Misma regla que en facturas: una línea exenta tiene que decir por qué.
      if (lines.some(l => l.taxRate === "" && l.description.trim() && !l.exemptionCause)) {
        Alert.alert(t("common.error"), t("invoicing.errExemptionCause"));
        setSaving(false); return;
      }
      const res = await fetch(`${APP_URL}/api/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          id: editId, orgId, clientCompanyId: clientId, status: "sent",
          issueDate: new Date().toISOString().slice(0, 10), validUntil: validUntil || null, notes,
          retentionPct: Number(retentionPct) || 0, discountPct: Number(discountPct) || 0,
          lines: lines.filter(l => l.description.trim()).map(l => ({ productId: l.productId, description: l.description, quantity: qtyOf(l.quantity), unitPrice: priceOf(l.unitPrice), taxRate: Number(l.taxRate) || 0, exemptionCause: l.taxRate === "" ? l.exemptionCause : null })),
        }),
      });
      const json = await readJson(res);
      if (!res.ok) { Alert.alert(t("common.error"), json.detail ?? json.error ?? t("invoicing.errGeneric")); setSaving(false); return; }
      setModal(false); resetForm(); await load();
    } catch (e) { Alert.alert(t("common.error"), String(e)); }
    setSaving(false);
  };

  const del = (q: Quote) => {
    Alert.alert(t("quoting.deleteTitle"), t("quoting.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("quoting.delete"), style: "destructive", onPress: async () => {
        setBusyId(q.id);
        await supabase.from("quotes").delete().eq("id", q.id);
        await load(); setBusyId(null);
      } },
    ]);
  };

  const sharePdf = async (q: Quote) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(`${orgId}/quotes/${q.id}.pdf`, 3600);
    if (data?.signedUrl) Linking.openURL(data.signedUrl);
    else Alert.alert(t("common.error"), t("quoting.pdfUnavailable"));
  };

  const statusColor = (s: string) => s === "accepted" ? C.green : s === "rejected" ? C.red : C.blue;

  const Header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} /></TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: "700", color: C.text }}>{t("quoting.title")}</Text>
      </View>
      {canManage && (
        <TouchableOpacity onPress={() => { resetForm(); setModal(true); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.blue, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 }}>
          <Plus size={16} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>{t("quoting.new")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (!paid) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        {Header}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Lock size={26} color={C.blue} /></View>
          <Text style={{ fontSize: 17, fontWeight: "600", color: C.text, textAlign: "center" }}>{t("quoting.paywallTitle")}</Text>
          <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", marginTop: 8 }}>{t("quoting.paywallBody")}</Text>
          <BillingNotice style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  const Chip = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: active ? C.blue : C.border, backgroundColor: active ? C.blueL : C.surface }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: active ? C.blue : C.muted }}>{label}</Text>
    </TouchableOpacity>
  );

  const ActBtn = ({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) => (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
      {icon}<Text style={{ fontSize: 12, fontWeight: "600", color: danger ? C.red : C.text }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {Header}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={quotes} keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.blue} />}
          ListEmptyComponent={<View style={{ alignItems: "center", paddingVertical: 60 }}><ClipboardList size={40} color={C.muted} /><Text style={{ color: C.muted, marginTop: 12 }}>{t("quoting.empty")}</Text></View>}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, opacity: busyId === item.id ? 0.5 : 1 }}>
              <TouchableOpacity onPress={() => router.push(`/(app)/presupuesto/${item.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{item.full_number ?? "—"}</Text>
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{item.client_name ?? "—"} · {item.issue_date ?? ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{fmtEur(item.total)}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: statusColor(item.status) }}>{t(`quoting.status.${item.status}`)}</Text>
                </View>
                <ChevronRight size={18} color={C.muted} />
              </TouchableOpacity>
              {canManage && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <ActBtn icon={<Download size={14} color={C.text} />} label={t("quoting.pdf")} onPress={() => sharePdf(item)} />
                  <ActBtn icon={<Pencil size={14} color={C.text} />} label={t("common.edit")} onPress={() => openEdit(item)} />
                  <ActBtn icon={<Trash2 size={14} color={C.red} />} label={t("quoting.delete")} onPress={() => del(item)} danger />
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Create / edit modal */}
      <KeyboardModal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>{editId ? t("quoting.edit") : t("quoting.new")}</Text>
            <TouchableOpacity onPress={() => setModal(false)}><X size={24} color={C.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            {/* Client */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted, marginBottom: 6 }}>{t("invoicing.client")} *</Text>
              <TouchableOpacity onPress={() => { setClientSearch(""); setClientPicker(true); }} style={{ backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ color: selectedClient ? C.text : C.muted }}>
                  {selectedClient ? `${selectedClient.name}${selectedClient.cif ? ` · ${selectedClient.cif}` : ` · ${t("invoicing.noCif")}`}` : t("invoicing.selectClient")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Válido hasta */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted, marginBottom: 6 }}>{t("quoting.validUntil")}</Text>
              <DateField value={validUntil || null} onChange={(v) => setValidUntil(v ?? "")} minimumDate={new Date()} />
            </View>

            {/* Lines */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted }}>{t("invoicing.lines")}</Text>
                <TouchableOpacity onPress={() => setLines([...lines, emptyLine()])}><Text style={{ color: C.blue, fontWeight: "600", fontSize: 13 }}>+ {t("invoicing.addLine")}</Text></TouchableOpacity>
              </View>
              {lines.map((l, i) => (
                <View key={i} style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <TextInput placeholder={t("invoicing.description")} placeholderTextColor={C.muted} value={l.description} onChangeText={(v) => setLine(i, { description: v })}
                    style={{ backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: C.text, marginBottom: 8 }} />
                  {products.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
                      {products.map(p => <Chip key={p.id} active={l.productId === p.id} label={p.name} onPress={() => pickProduct(i, p)} />)}
                    </ScrollView>
                  )}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput placeholder={t("invoicing.qty")} placeholderTextColor={C.muted} keyboardType="decimal-pad" value={l.quantity} onChangeText={(v) => setLine(i, { quantity: v })}
                      style={{ flex: 1, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: C.text }} />
                    <TextInput placeholder={t("invoicing.price")} placeholderTextColor={C.muted} keyboardType="decimal-pad" value={l.unitPrice} onChangeText={(v) => setLine(i, { unitPrice: v })}
                      style={{ flex: 1, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: C.text }} />
                    {lines.length > 1 && <TouchableOpacity onPress={() => setLines(lines.filter((_, idx) => idx !== i))} style={{ justifyContent: "center" }}><Trash2 size={18} color={C.red} /></TouchableOpacity>}
                  </View>
                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 8, marginBottom: 4 }}>{t("invoicing.iva")}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {IVA_RATES.map(r => (
                      <Chip key={r} active={l.taxRate === r} label={r === "" ? t("invoicing.exempt") : `${r}%`}
                        // Dejar de ser exenta descarta la causa: conservarla
                        // declararía una exención sobre una línea con impuesto.
                        onPress={() => setLine(i, { taxRate: r, ...(r !== "" ? { exemptionCause: "" } : {}) })} />
                    ))}
                  </View>
                  {/* Solo si la línea es exenta: la AEAT necesita saber por qué
                      artículo, y no hay valor por defecto que elegir por el
                      usuario. Igual que en facturas, para que no diverjan. */}
                  {l.taxRate === "" && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ fontSize: 11, color: l.exemptionCause ? C.muted : C.yellow, marginBottom: 6 }}>
                        {t("invoicing.exemptionCausePrompt")}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {EXEMPTION_CAUSES.map(c => (
                          <TouchableOpacity key={c.code} onPress={() => setLine(i, { exemptionCause: c.code })}
                            style={{
                              paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
                              borderColor: l.exemptionCause === c.code ? C.blue : C.border,
                              backgroundColor: l.exemptionCause === c.code ? C.blueL : "transparent",
                            }}>
                            <Text style={{ fontSize: 12, color: l.exemptionCause === c.code ? C.blue : C.text }}>
                              {exemptionShort(c.code)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                        {EXEMPTION_CAUSES.find(c => c.code === l.exemptionCause)?.es ?? ""}
                      </Text>
                    </View>
                  )}
                  {l.description.trim().length > 0 && !l.productId && (
                    <TouchableOpacity onPress={() => addToInventory(i)} style={{ marginTop: 8 }}>
                      <Text style={{ color: C.blue, fontSize: 12, fontWeight: "600" }}>+ {t("quoting.addToInventory")}</Text>
                    </TouchableOpacity>
                  )}
                  {l.productId && <Text style={{ marginTop: 8, fontSize: 11, color: C.muted }}>✓ {t("quoting.inInventory")}</Text>}
                </View>
              ))}
            </View>

            {/* Retención */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted, marginBottom: 8 }}>{t("invoicing.retention")}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {RET_RATES.map(r => <Chip key={r} active={retentionPct === r} label={r === "" ? t("invoicing.noRetention") : `${r}%`} onPress={() => setRetentionPct(r)} />)}
              </View>
            </View>

            {/* Descuento */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted, marginBottom: 8 }}>{t("invoicing.discount")}</Text>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {DISC_RATES.map(r => <Chip key={r} active={discountPct === r} label={r === "" ? t("invoicing.noDiscount") : `${r}%`} onPress={() => setDiscountPct(r)} />)}
                <TextInput placeholder="%" placeholderTextColor={C.muted} keyboardType="decimal-pad"
                  value={DISC_RATES.includes(discountPct) ? "" : discountPct} onChangeText={setDiscountPct}
                  style={{ width: 56, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: C.text, backgroundColor: C.inputBg, textAlign: "right" }} />
              </View>
            </View>

            {/* Notas */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted, marginBottom: 6 }}>{t("quoting.notes")}</Text>
              <TextInput placeholder={t("quoting.notesPlaceholder")} placeholderTextColor={C.muted} value={notes} onChangeText={setNotes} multiline
                style={{ backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.text, minHeight: 60, textAlignVertical: "top" }} />
            </View>

            {/* Totals */}
            <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, gap: 4 }}>
              <Row label={t("invoicing.subtotal")} value={fmtEur(totals.subtotal)} C={C} />
              {totals.discount > 0 && <Row label={`${t("invoicing.discount")} (${discountPct}%)`} value={`−${fmtEur(totals.discount)}`} C={C} />}
              <Row label={t("invoicing.iva")} value={fmtEur(totals.tax)} C={C} />
              {totals.ret > 0 && <Row label={`${t("invoicing.retention")} (${retentionPct}%)`} value={`−${fmtEur(totals.ret)}`} C={C} />}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
              <Row label={t("invoicing.total")} value={fmtEur(totals.total)} C={C} bold />
            </View>
          </ScrollView>

          <View style={{ padding: 16 }}>
            <TouchableOpacity onPress={save} disabled={saving} style={{ backgroundColor: C.blue, borderRadius: 12, paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: saving ? 0.6 : 1 }}>
              {saving ? <ActivityIndicator color="#fff" /> : <ClipboardList size={18} color="#fff" />}
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{editId ? t("quoting.saveChanges") : t("quoting.create")}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardModal>

      {/* Client picker modal */}
      <KeyboardModal visible={clientPicker} animationType="slide" transparent onRequestClose={() => setClientPicker(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{t("invoicing.client")}</Text>
              <TouchableOpacity onPress={() => setClientPicker(false)}><X size={22} color={C.muted} /></TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, marginBottom: 10 }}>
              <SearchIcon size={15} color={C.muted} />
              <TextInput placeholder={t("invoicing.searchClient")} placeholderTextColor={C.muted} value={clientSearch} onChangeText={setClientSearch} autoCorrect={false}
                style={{ flex: 1, paddingVertical: 9, color: C.text }} />
              {clientSearch.length > 0 && (
                <TouchableOpacity onPress={() => setClientSearch("")} hitSlop={8}><X size={15} color={C.muted} /></TouchableOpacity>
              )}
            </View>
            {/* The same full form as facturación — a client picked here can
                end up on an invoice, so it must be complete. */}
            <TouchableOpacity onPress={() => setNewClientOpen(true)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: C.blueMed, backgroundColor: C.blueL, borderRadius: 8, paddingVertical: 10, marginBottom: 12 }}>
              <Plus size={16} color={C.blue} />
              <Text style={{ color: C.blue, fontWeight: "600", fontSize: 14 }}>{t("invoicing.newClient")}</Text>
            </TouchableOpacity>
            <FlatList data={clientMatches} keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={{ color: C.muted, paddingVertical: 16, textAlign: "center" }}>{t("invoicing.noClientMatches")}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { setClientId(item.id); setClientPicker(false); }} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ color: C.text, fontSize: 15 }}>{item.name}</Text>
                  <Text style={{ color: C.muted, fontSize: 12 }}>{item.cif ?? t("invoicing.noCif")}</Text>
                </TouchableOpacity>
              )} />
          </View>
        </View>
      </KeyboardModal>

      <NewClientModal
        visible={newClientOpen}
        orgId={orgId}
        onCreated={onClientCreated}
        onClose={() => setNewClientOpen(false)}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, C, bold }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: bold ? C.text : C.muted, fontWeight: bold ? "700" : "400", fontSize: bold ? 16 : 14 }}>{label}</Text>
      <Text style={{ color: C.text, fontWeight: bold ? "700" : "400", fontSize: bold ? 16 : 14 }}>{value}</Text>
    </View>
  );
}

export default function PresupuestosScreen() {
  return (
    <RequirePermission section="presupuestos">
      <PresupuestosScreenContent />
    </RequirePermission>
  );
}
