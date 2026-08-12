import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Plus, ClipboardList, X, Trash2, Lock, ArrowLeft, ChevronRight,
  Search as SearchIcon, Download, Pencil,
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
import { Badge, Button, Card, EmptyState, Input, type BadgeTone } from "@/components/ui";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";

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

  const statusTone = (s: string): BadgeTone => s === "accepted" ? "green" : s === "rejected" ? "red" : "blue";

  const Header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} strokeWidth={1.75} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text }}>{t("quoting.title")}</Text>
      </View>
      {canManage && (
        <Button
          label={t("quoting.new")}
          onPress={() => { resetForm(); setModal(true); }}
          size="md"
          fullWidth={false}
          icon={<Plus size={16} color="#fff" strokeWidth={1.75} />}
        />
      )}
    </View>
  );

  if (!paid) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        {Header}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}><Lock size={26} color={C.blue} strokeWidth={1.75} /></View>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: C.text, textAlign: "center" }}>{t("quoting.paywallTitle")}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted, textAlign: "center", marginTop: spacing.sm }}>{t("quoting.paywallBody")}</Text>
          <BillingNotice style={{ marginTop: spacing.xl - 4 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {Header}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={quotes} keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm + 2 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.blue} />}
          ListEmptyComponent={
            <EmptyState
              icon={<ClipboardList size={28} color={C.muted} strokeWidth={1.5} />}
              title={t("quoting.empty")}
            />
          }
          renderItem={({ item }) => (
            <Card containerStyle={{ opacity: busyId === item.id ? 0.5 : 1 }}>
              <TouchableOpacity onPress={() => router.push(`/(app)/presupuesto/${item.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text }}>{item.full_number ?? "—"}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: 2 }}>{item.client_name ?? "—"} · {item.issue_date ?? ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: C.text }}>{fmtEur(item.total)}</Text>
                  <Badge label={t(`quoting.status.${item.status}`)} tone={statusTone(item.status)} />
                </View>
                <ChevronRight size={18} color={C.muted} strokeWidth={1.75} />
              </TouchableOpacity>
              {canManage && (
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
                  <ActBtn icon={<Download size={14} color={C.text} strokeWidth={1.75} />} label={t("quoting.pdf")} onPress={() => sharePdf(item)} C={C} />
                  <ActBtn icon={<Pencil size={14} color={C.text} strokeWidth={1.75} />} label={t("common.edit")} onPress={() => openEdit(item)} C={C} />
                  <ActBtn icon={<Trash2 size={14} color={C.red} strokeWidth={1.75} />} label={t("quoting.delete")} onPress={() => del(item)} danger C={C} />
                </View>
              )}
            </Card>
          )}
        />
      )}

      {/* Create / edit modal */}
      <KeyboardModal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: C.text }}>{editId ? t("quoting.edit") : t("quoting.new")}</Text>
            <TouchableOpacity onPress={() => setModal(false)}><X size={24} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md + 2 }} keyboardShouldPersistTaps="handled">
            {/* Client */}
            <View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted, marginBottom: spacing.sm - 2 }}>{t("invoicing.client")} *</Text>
              <TouchableOpacity onPress={() => { setClientSearch(""); setClientPicker(true); }} style={{ backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: selectedClient ? C.text : C.muted }}>
                  {selectedClient ? `${selectedClient.name}${selectedClient.cif ? ` · ${selectedClient.cif}` : ` · ${t("invoicing.noCif")}`}` : t("invoicing.selectClient")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Válido hasta */}
            <View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted, marginBottom: spacing.sm - 2 }}>{t("quoting.validUntil")}</Text>
              <DateField value={validUntil || null} onChange={(v) => setValidUntil(v ?? "")} minimumDate={new Date()} />
            </View>

            {/* Lines */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted }}>{t("invoicing.lines")}</Text>
                <TouchableOpacity onPress={() => setLines([...lines, emptyLine()])}><Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.blue }}>+ {t("invoicing.addLine")}</Text></TouchableOpacity>
              </View>
              {lines.map((l, i) => (
                <Card key={i} containerStyle={{ marginBottom: spacing.sm + 2 }}>
                  <Input placeholder={t("invoicing.description")} value={l.description} onChangeText={(v) => setLine(i, { description: v })}
                    style={{ marginBottom: spacing.sm }} />
                  {products.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }} contentContainerStyle={{ gap: 6 }}>
                      {products.map(p => <Chip key={p.id} active={l.productId === p.id} label={p.name} onPress={() => pickProduct(i, p)} C={C} />)}
                    </ScrollView>
                  )}
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Input placeholder={t("invoicing.qty")} keyboardType="decimal-pad" value={l.quantity} onChangeText={(v) => setLine(i, { quantity: v })}
                      style={{ flex: 1 }} />
                    <Input placeholder={t("invoicing.price")} keyboardType="decimal-pad" value={l.unitPrice} onChangeText={(v) => setLine(i, { unitPrice: v })}
                      style={{ flex: 1 }} />
                    {lines.length > 1 && <TouchableOpacity onPress={() => setLines(lines.filter((_, idx) => idx !== i))} style={{ justifyContent: "center" }}><Trash2 size={18} color={C.red} strokeWidth={1.75} /></TouchableOpacity>}
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: spacing.sm, marginBottom: spacing.xs }}>{t("invoicing.iva")}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {IVA_RATES.map(r => (
                      <Chip key={r} active={l.taxRate === r} label={r === "" ? t("invoicing.exempt") : `${r}%`}
                        // Dejar de ser exenta descarta la causa: conservarla
                        // declararía una exención sobre una línea con impuesto.
                        onPress={() => setLine(i, { taxRate: r, ...(r !== "" ? { exemptionCause: "" } : {}) })} C={C} />
                    ))}
                  </View>
                  {/* Solo si la línea es exenta: la AEAT necesita saber por qué
                      artículo, y no hay valor por defecto que elegir por el
                      usuario. Igual que en facturas, para que no diverjan. */}
                  {l.taxRate === "" && (
                    <View style={{ marginTop: spacing.sm + 2 }}>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: l.exemptionCause ? C.muted : C.yellow, marginBottom: spacing.sm - 2 }}>
                        {t("invoicing.exemptionCausePrompt")}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {EXEMPTION_CAUSES.map(c => (
                          <TouchableOpacity key={c.code} onPress={() => setLine(i, { exemptionCause: c.code })}
                            style={{
                              paddingHorizontal: spacing.sm + 2, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1,
                              borderColor: l.exemptionCause === c.code ? C.blue : C.border,
                              backgroundColor: l.exemptionCause === c.code ? C.blueL : "transparent",
                            }}>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: l.exemptionCause === c.code ? C.blue : C.text }}>
                              {exemptionShort(c.code)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: C.muted, marginTop: spacing.sm - 2 }}>
                        {EXEMPTION_CAUSES.find(c => c.code === l.exemptionCause)?.es ?? ""}
                      </Text>
                    </View>
                  )}
                  {l.description.trim().length > 0 && !l.productId && (
                    <TouchableOpacity onPress={() => addToInventory(i)} style={{ marginTop: spacing.sm }}>
                      <Text style={{ fontFamily: fonts.semibold, color: C.blue, fontSize: 12 }}>+ {t("quoting.addToInventory")}</Text>
                    </TouchableOpacity>
                  )}
                  {l.productId && <Text style={{ marginTop: spacing.sm, fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>✓ {t("quoting.inInventory")}</Text>}
                </Card>
              ))}
            </View>

            {/* Retención */}
            <View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted, marginBottom: spacing.sm }}>{t("invoicing.retention")}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {RET_RATES.map(r => <Chip key={r} active={retentionPct === r} label={r === "" ? t("invoicing.noRetention") : `${r}%`} onPress={() => setRetentionPct(r)} C={C} />)}
              </View>
            </View>

            {/* Descuento */}
            <View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted, marginBottom: spacing.sm }}>{t("invoicing.discount")}</Text>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {DISC_RATES.map(r => <Chip key={r} active={discountPct === r} label={r === "" ? t("invoicing.noDiscount") : `${r}%`} onPress={() => setDiscountPct(r)} C={C} />)}
                <Input placeholder="%" keyboardType="decimal-pad"
                  value={DISC_RATES.includes(discountPct) ? "" : discountPct} onChangeText={setDiscountPct}
                  style={{ width: 64, textAlign: "right", paddingVertical: 8, paddingHorizontal: spacing.sm }} />
              </View>
            </View>

            {/* Notas */}
            <View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted, marginBottom: spacing.sm - 2 }}>{t("quoting.notes")}</Text>
              <Input placeholder={t("quoting.notesPlaceholder")} value={notes} onChangeText={setNotes} multiline
                style={{ minHeight: 60, textAlignVertical: "top", paddingTop: spacing.sm + 2 }} />
            </View>

            {/* Totals */}
            <Card style={{ gap: spacing.xs }}>
              <Row label={t("invoicing.subtotal")} value={fmtEur(totals.subtotal)} C={C} />
              {totals.discount > 0 && <Row label={`${t("invoicing.discount")} (${discountPct}%)`} value={`−${fmtEur(totals.discount)}`} C={C} />}
              <Row label={t("invoicing.iva")} value={fmtEur(totals.tax)} C={C} />
              {totals.ret > 0 && <Row label={`${t("invoicing.retention")} (${retentionPct}%)`} value={`−${fmtEur(totals.ret)}`} C={C} />}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
              <Row label={t("invoicing.total")} value={fmtEur(totals.total)} C={C} bold />
            </Card>
          </ScrollView>

          <View style={{ padding: spacing.lg }}>
            <Button
              label={editId ? t("quoting.saveChanges") : t("quoting.create")}
              onPress={save}
              disabled={saving}
              loading={saving}
              icon={<ClipboardList size={18} color="#fff" strokeWidth={1.75} />}
            />
          </View>
        </SafeAreaView>
      </KeyboardModal>

      {/* Client picker modal */}
      <KeyboardModal visible={clientPicker} animationType="slide" transparent onRequestClose={() => setClientPicker(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl - 4, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: C.text }}>{t("invoicing.client")}</Text>
              <TouchableOpacity onPress={() => setClientPicker(false)}><X size={22} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm + 2, marginBottom: spacing.sm + 2 }}>
              <SearchIcon size={15} color={C.muted} strokeWidth={1.75} />
              <TextInput placeholder={t("invoicing.searchClient")} placeholderTextColor={C.muted} value={clientSearch} onChangeText={setClientSearch} autoCorrect={false}
                style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 9, color: C.text }} />
              {clientSearch.length > 0 && (
                <TouchableOpacity onPress={() => setClientSearch("")} hitSlop={8}><X size={15} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
              )}
            </View>
            {/* The same full form as facturación — a client picked here can
                end up on an invoice, so it must be complete. */}
            <Button
              label={t("invoicing.newClient")}
              onPress={() => setNewClientOpen(true)}
              variant="ghost"
              icon={<Plus size={16} color={C.blue} strokeWidth={1.75} />}
              style={{ backgroundColor: C.blueL, borderWidth: 1, borderColor: C.blueMed, marginBottom: spacing.md }}
            />
            <FlatList data={clientMatches} keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={{ fontFamily: fonts.regular, color: C.muted, paddingVertical: spacing.md + 2, textAlign: "center" }}>{t("invoicing.noClientMatches")}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { setClientId(item.id); setClientPicker(false); }} style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ fontFamily: fonts.regular, color: C.text, fontSize: 15 }}>{item.name}</Text>
                  <Text style={{ fontFamily: fonts.regular, color: C.muted, fontSize: 12 }}>{item.cif ?? t("invoicing.noCif")}</Text>
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
      <Text style={{ fontFamily: bold ? fonts.bold : fonts.regular, color: bold ? C.text : C.muted, fontSize: bold ? 16 : 14 }}>{label}</Text>
      <Text style={{ fontFamily: bold ? fonts.bold : fonts.regular, color: C.text, fontSize: bold ? 16 : 14 }}>{value}</Text>
    </View>
  );
}

function Chip({ active, label, onPress, C }: { active: boolean; label: string; onPress: () => void; C: any }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? C.blue : C.border, backgroundColor: active ? C.blueL : C.surface }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: active ? C.blue : C.muted }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActBtn({ icon, label, onPress, danger, C }: { icon: any; label: string; onPress: () => void; danger?: boolean; C: any }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: C.border }}>
      {icon}<Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: danger ? C.red : C.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function PresupuestosScreen() {
  return (
    <RequirePermission section="presupuestos">
      <PresupuestosScreenContent />
    </RequirePermission>
  );
}
