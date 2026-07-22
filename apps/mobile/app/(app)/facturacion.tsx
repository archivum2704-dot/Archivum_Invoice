import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, Modal, ScrollView, Alert, Linking,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, Receipt, X, Trash2, Lock, ArrowLeft, ShieldCheck, ChevronRight, Search as SearchIcon, ChevronDown, Clock } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { APP_URL } from "@/lib/config";

const IVA_RATES = ["", "4", "10", "21"];
const RET_RATES = ["", "7", "15", "19"];

interface Invoice { id: string; full_number: string | null; client_name: string | null; total: number; state: string; issue_date: string | null; }
interface Company { id: string; name: string; cif: string | null; }
interface Product { id: string; name: string; unit_price: number; tax_rate: number; }
type Line = { productId: string | null; description: string; quantity: string; unitPrice: string; taxRate: string };

// A locally-stored invoice the user started but never successfully issued ("grabó").
interface LocalDraft { id: string; clientId: string; clientName: string | null; retentionPct: string; lines: Line[]; total: number; savedAt: string; }
const draftsKey = (orgId: string) => `invoice_drafts_${orgId}`;

const emptyLine = (): Line => ({ productId: null, description: "", quantity: "1", unitPrice: "0", taxRate: "21" });
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function FacturacionScreen() {
  const { t } = useTranslation();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { session, orgId, org, isAdmin, isPaid, isPlatformAdmin } = useAuth();
  const paid = isPaid || isPlatformAdmin;
  const canManage = isAdmin && paid;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modal, setModal] = useState(false);
  const [clientPicker, setClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [retentionPct, setRetentionPct] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [issuing, setIssuing] = useState(false);
  // Local drafts (started but not yet issued)
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  // Article picker (per invoice line)
  const [productPicker, setProductPicker] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  // Inline new client
  const [ncName, setNcName] = useState(""); const [ncCif, setNcCif] = useState("");

  const fmtEur = (n: number) => `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const selectedClient = companies.find(c => c.id === clientId);

  const clientMatches = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(c => c.name.toLowerCase().includes(q) || (c.cif ?? "").toLowerCase().includes(q));
  }, [companies, clientSearch]);

  const productMatches = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [{ data: inv }, { data: co }, { data: pr }] = await Promise.all([
      supabase.from("invoices").select("id, full_number, client_name, total, state, issue_date").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name, cif").eq("organization_id", orgId).eq("is_active", true).order("name"),
      supabase.from("products").select("id, name, unit_price, tax_rate").eq("organization_id", orgId).eq("is_active", true).order("name"),
    ]);
    setInvoices((inv as Invoice[]) ?? []); setCompanies((co as Company[]) ?? []); setProducts((pr as Product[]) ?? []);
    setLoading(false); setRefreshing(false);
  }, [orgId]);

  const loadDrafts = useCallback(async () => {
    if (!orgId) return;
    try {
      const raw = await AsyncStorage.getItem(draftsKey(orgId));
      setDrafts(raw ? (JSON.parse(raw) as LocalDraft[]) : []);
    } catch { setDrafts([]); }
  }, [orgId]);

  const persistDrafts = useCallback(async (next: LocalDraft[]) => {
    setDrafts(next);
    if (!orgId) return;
    try { await AsyncStorage.setItem(draftsKey(orgId), JSON.stringify(next)); } catch {}
  }, [orgId]);

  useEffect(() => { if (paid) { load(); loadDrafts(); } else setLoading(false); }, [load, loadDrafts, paid]);

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const l of lines) {
      const base = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      subtotal += base; tax += base * (Number(l.taxRate) || 0) / 100;
    }
    const ret = r2(subtotal * (Number(retentionPct) || 0) / 100);
    return { subtotal: r2(subtotal), tax: r2(tax), ret, total: r2(subtotal + tax - ret) };
  }, [lines, retentionPct]);

  const resetForm = () => { setClientId(""); setRetentionPct(""); setLines([emptyLine()]); setEditingDraftId(null); };

  const setLine = (i: number, patch: Partial<Line>) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const pickProduct = (i: number, p: Product) => { setLine(i, { productId: p.id, description: p.name, unitPrice: String(p.unit_price), taxRate: String(p.tax_rate) }); setProductPicker(null); setProductSearch(""); };

  // Does the current form hold anything worth keeping as a draft?
  const hasDraftContent = () =>
    !!clientId || lines.some(l => l.description.trim() || (Number(l.quantity) || 0) !== 0 && l.quantity !== "1" || (Number(l.unitPrice) || 0) !== 0);

  const openNew = () => { resetForm(); setModal(true); };

  const openDraft = (d: LocalDraft) => {
    setEditingDraftId(d.id);
    setClientId(d.clientId);
    setRetentionPct(d.retentionPct);
    setLines(d.lines.length ? d.lines : [emptyLine()]);
    setModal(true);
  };

  // Persist the in-progress form as a local draft when the user leaves without issuing.
  const closeModal = async () => {
    if (hasDraftContent()) {
      const id = editingDraftId ?? `draft_${Date.now()}`;
      const draft: LocalDraft = {
        id, clientId, clientName: selectedClient?.name ?? null,
        retentionPct, lines, total: totals.total, savedAt: new Date().toISOString(),
      };
      await persistDrafts([draft, ...drafts.filter(d => d.id !== id)]);
    }
    setModal(false); resetForm();
  };

  const removeDraft = (d: LocalDraft) => {
    Alert.alert(t("invoicing.deleteDraftTitle"), t("invoicing.deleteDraftConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => persistDrafts(drafts.filter(x => x.id !== d.id)) },
    ]);
  };

  const createClient = async () => {
    if (!ncName.trim() || !orgId) return;
    const { data, error } = await supabase.from("companies").insert({ organization_id: orgId, name: ncName.trim(), cif: ncCif.trim() || null, is_active: true }).select("id, name, cif").single();
    if (error || !data) { Alert.alert(t("common.error"), error?.message ?? ""); return; }
    setCompanies(prev => [...prev, data as Company].sort((a, b) => a.name.localeCompare(b.name)));
    setClientId(data.id); setNcName(""); setNcCif(""); setClientPicker(false);
  };

  const issue = async () => {
    if (!org?.cif?.trim()) { Alert.alert(t("common.error"), t("invoicing.errIssuerCif")); return; }
    if (!clientId) { Alert.alert(t("common.error"), t("invoicing.errClient")); return; }
    if (!selectedClient?.cif?.trim()) { Alert.alert(t("common.error"), t("invoicing.errClientCif")); return; }
    if (!lines.some(l => l.description.trim())) { Alert.alert(t("common.error"), t("invoicing.errLines")); return; }
    setIssuing(true);
    try {
      const res = await fetch(`${APP_URL}/api/invoices/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          orgId, clientCompanyId: clientId, series: "FAC", kind: "ordinary",
          issueDate: new Date().toISOString().slice(0, 10), retentionPct: Number(retentionPct) || 0,
          lines: lines.filter(l => l.description.trim()).map(l => ({ productId: l.productId, description: l.description, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, taxRate: Number(l.taxRate) || 0, discountPct: 0 })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { Alert.alert(t("common.error"), json.detail ?? json.error ?? t("invoicing.errGeneric")); setIssuing(false); return; }
      if (editingDraftId) await persistDrafts(drafts.filter(d => d.id !== editingDraftId));
      setModal(false); resetForm(); await load();
      router.push(`/(app)/factura/${json.id}`);
    } catch (e) { Alert.alert(t("common.error"), String(e)); }
    setIssuing(false);
  };

  const stateColor = (s: string) => s === "issued" ? C.green : s === "cancelled" ? C.red : C.muted;

  const Header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} /></TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: "700", color: C.text }}>{t("invoicing.title")}</Text>
      </View>
      {canManage && (
        <TouchableOpacity onPress={openNew} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.blue, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 }}>
          <Plus size={16} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>{t("invoicing.new")}</Text>
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
          <Text style={{ fontSize: 17, fontWeight: "600", color: C.text, textAlign: "center" }}>{t("invoicing.paywallTitle")}</Text>
          <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", marginTop: 8 }}>{t("invoicing.paywallBody")}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`${APP_URL}/configuracion/billing`)} style={{ marginTop: 20, backgroundColor: C.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>{t("invoicing.upgrade")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const Chip = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: active ? C.blue : C.border, backgroundColor: active ? C.blueL : C.surface }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: active ? C.blue : C.muted }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {Header}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View>
      ) : (
        <FlatList
          data={invoices} keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); loadDrafts(); }} tintColor={C.blue} />}
          ListHeaderComponent={drafts.length > 0 ? (
            <View style={{ gap: 10, marginBottom: 10 }}>
              {drafts.map(d => (
                <View key={d.id} style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.yellow, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <TouchableOpacity onPress={() => openDraft(d)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: C.yellowL, alignItems: "center", justifyContent: "center" }}>
                      <Clock size={16} color={C.yellow} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{d.clientName ?? t("invoicing.new")}</Text>
                      <Text style={{ fontSize: 12, color: C.yellow, fontWeight: "600", marginTop: 2 }}>{t("invoicing.pendingDraft")}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{fmtEur(d.total)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeDraft(d)} hitSlop={8} style={{ padding: 4 }}><Trash2 size={18} color={C.red} /></TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          ListEmptyComponent={drafts.length > 0 ? null : <View style={{ alignItems: "center", paddingVertical: 60 }}><Receipt size={40} color={C.muted} /><Text style={{ color: C.muted, marginTop: 12 }}>{t("invoicing.empty")}</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/(app)/factura/${item.id}`)} style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{item.full_number ?? "—"}</Text>
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{item.client_name ?? "—"} · {item.issue_date ?? ""}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{fmtEur(item.total)}</Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color: stateColor(item.state) }}>{t(`invoicing.states.${item.state}`)}</Text>
              </View>
              <ChevronRight size={18} color={C.muted} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* New invoice modal */}
      <Modal visible={modal} animationType="slide" onRequestClose={closeModal}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>{t("invoicing.new")}</Text>
            <TouchableOpacity onPress={closeModal}><X size={24} color={C.muted} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {/* Client */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted, marginBottom: 6 }}>{t("invoicing.client")} *</Text>
              <TouchableOpacity onPress={() => { setClientSearch(""); setClientPicker(true); }} style={{ backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ color: selectedClient ? C.text : C.muted }}>
                  {selectedClient ? `${selectedClient.name}${selectedClient.cif ? ` · ${selectedClient.cif}` : ` · ${t("invoicing.noCif")}`}` : t("invoicing.selectClient")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Lines */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted }}>{t("invoicing.lines")}</Text>
                <TouchableOpacity onPress={() => setLines([...lines, emptyLine()])}><Text style={{ color: C.blue, fontWeight: "600", fontSize: 13 }}>+ {t("invoicing.addLine")}</Text></TouchableOpacity>
              </View>
              {lines.map((l, i) => (
                <View key={i} style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  {/* Description — free text, or auto-filled from the article picker.
                      Editing the text must NOT unlink the product — the link drives
                      the automatic stock deduction at issue time. */}
                  <Text style={{ fontSize: 11, fontWeight: "600", color: C.muted, marginBottom: 4 }}>{t("invoicing.description")}</Text>
                  <TextInput placeholder={t("invoicing.description")} placeholderTextColor={C.muted} value={l.description} onChangeText={(v) => setLine(i, { description: v })}
                    style={{ backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: C.text, marginBottom: 8 }} />
                  {products.length > 0 && (
                    <TouchableOpacity onPress={() => { setProductSearch(""); setProductPicker(i); }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 8 }}>
                      <SearchIcon size={14} color={C.muted} />
                      <Text style={{ flex: 1, color: l.productId ? C.text : C.muted, fontSize: 13 }} numberOfLines={1}>
                        {l.productId ? (products.find(p => p.id === l.productId)?.name ?? t("invoicing.searchProduct")) : t("invoicing.searchProduct")}
                      </Text>
                      <ChevronDown size={16} color={C.muted} />
                    </TouchableOpacity>
                  )}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: C.muted, marginBottom: 4 }}>{t("invoicing.units")}</Text>
                      <TextInput placeholder={t("invoicing.qty")} placeholderTextColor={C.muted} keyboardType="decimal-pad" value={l.quantity} onChangeText={(v) => setLine(i, { quantity: v })}
                        style={{ backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: C.text }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: C.muted, marginBottom: 4 }}>{t("invoicing.priceEur")}</Text>
                      <TextInput placeholder={t("invoicing.price")} placeholderTextColor={C.muted} keyboardType="decimal-pad" value={l.unitPrice} onChangeText={(v) => setLine(i, { unitPrice: v })}
                        style={{ backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: C.text }} />
                    </View>
                    {lines.length > 1 && <TouchableOpacity onPress={() => setLines(lines.filter((_, idx) => idx !== i))} style={{ justifyContent: "flex-end", paddingBottom: 8 }}><Trash2 size={18} color={C.red} /></TouchableOpacity>}
                  </View>
                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 8, marginBottom: 4 }}>{t("invoicing.iva")}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {IVA_RATES.map(r => <Chip key={r} active={l.taxRate === r} label={r === "" ? t("invoicing.exempt") : `${r}%`} onPress={() => setLine(i, { taxRate: r })} />)}
                  </View>
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

            {/* Totals */}
            <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, gap: 4 }}>
              <Row label={t("invoicing.subtotal")} value={fmtEur(totals.subtotal)} C={C} />
              <Row label={t("invoicing.iva")} value={fmtEur(totals.tax)} C={C} />
              {totals.ret > 0 && <Row label={`${t("invoicing.retention")} (${retentionPct}%)`} value={`−${fmtEur(totals.ret)}`} C={C} />}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
              <Row label={t("invoicing.total")} value={fmtEur(totals.total)} C={C} bold />
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg }}>
            <TouchableOpacity onPress={issue} disabled={issuing} style={{ backgroundColor: C.blue, borderRadius: 12, paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: issuing ? 0.6 : 1 }}>
              {issuing ? <ActivityIndicator color="#fff" /> : <ShieldCheck size={18} color="#fff" />}
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("invoicing.issue")}</Text>
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Client picker modal */}
      <Modal visible={clientPicker} animationType="slide" transparent onRequestClose={() => setClientPicker(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 20 + insets.bottom, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{t("invoicing.client")}</Text>
              <TouchableOpacity onPress={() => setClientPicker(false)}><X size={22} color={C.muted} /></TouchableOpacity>
            </View>
            {/* Type-to-search filter */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, marginBottom: 10 }}>
              <SearchIcon size={15} color={C.muted} />
              <TextInput placeholder={t("invoicing.searchClient")} placeholderTextColor={C.muted} value={clientSearch} onChangeText={setClientSearch} autoCorrect={false}
                style={{ flex: 1, paddingVertical: 9, color: C.text }} />
              {clientSearch.length > 0 && (
                <TouchableOpacity onPress={() => setClientSearch("")} hitSlop={8}><X size={15} color={C.muted} /></TouchableOpacity>
              )}
            </View>
            {/* Inline new client */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <TextInput placeholder={t("invoicing.clientName")} placeholderTextColor={C.muted} value={ncName} onChangeText={setNcName}
                style={{ flex: 2, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: C.text }} />
              <TextInput placeholder="CIF" placeholderTextColor={C.muted} value={ncCif} onChangeText={setNcCif} autoCapitalize="characters"
                style={{ flex: 1, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: C.text }} />
              <TouchableOpacity onPress={createClient} disabled={!ncName.trim()} style={{ backgroundColor: C.blue, borderRadius: 8, paddingHorizontal: 14, justifyContent: "center", opacity: ncName.trim() ? 1 : 0.5 }}>
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Article picker modal (per line) */}
      <Modal visible={productPicker !== null} animationType="slide" transparent onRequestClose={() => setProductPicker(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 20 + insets.bottom, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{t("invoicing.selectProduct")}</Text>
              <TouchableOpacity onPress={() => setProductPicker(null)}><X size={22} color={C.muted} /></TouchableOpacity>
            </View>
            {/* Type-to-search filter */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, marginBottom: 10 }}>
              <SearchIcon size={15} color={C.muted} />
              <TextInput placeholder={t("invoicing.searchProduct")} placeholderTextColor={C.muted} value={productSearch} onChangeText={setProductSearch} autoCorrect={false}
                style={{ flex: 1, paddingVertical: 9, color: C.text }} />
              {productSearch.length > 0 && (
                <TouchableOpacity onPress={() => setProductSearch("")} hitSlop={8}><X size={15} color={C.muted} /></TouchableOpacity>
              )}
            </View>
            <FlatList data={productMatches} keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={{ color: C.muted, paddingVertical: 16, textAlign: "center" }}>{t("invoicing.noProductMatches")}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { if (productPicker !== null) pickProduct(productPicker, item); }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ color: C.text, fontSize: 15, flex: 1 }}>{item.name}</Text>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{fmtEur(item.unit_price)} · {Number(item.tax_rate)}%</Text>
                </TouchableOpacity>
              )} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
