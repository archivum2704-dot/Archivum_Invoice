import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, Receipt, X, Trash2, Lock, ArrowLeft, ShieldCheck, ChevronRight, Search as SearchIcon, AlertTriangle } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { BillingNotice } from "@/components/BillingNotice";
import { APP_URL } from "@/lib/config";
import { RequirePermission } from "@/components/RequirePermission";
import { KeyboardModal } from "@/components/KeyboardModal";
import { NewClientModal, type CreatedClient } from "@/components/NewClientModal";
import { readJson } from "@/lib/api";
import { EXEMPTION_CAUSES, exemptionShort } from "@/lib/exemption-causes";
import { Badge, Button, Card, EmptyState, Input, type BadgeTone } from "@/components/ui";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { CURRENCIES, DEFAULT_CURRENCY, needsExchangeRate, formatMoney } from "@/lib/currency";
import { getStockWarnings } from "@/lib/stock";
import { confirmStockWarnings } from "@/lib/stock-warning-alert";

const IVA_RATES = ["", "4", "10", "21"];
const RET_RATES = ["", "7", "15", "19"];
const DISC_RATES = ["", "5", "10", "15", "20"];

interface Invoice {
  id: string; full_number: string | null; client_name: string | null;
  total: number; state: string; issue_date: string | null;
  kind: string; rectifies_invoice_id: string | null;
  verifactu_status: string | null; currency: string;
}
interface Company { id: string; name: string; cif: string | null; }
interface Product {
  id: string; name: string; unit_price: number; tax_rate: number;
  unit: string; track_stock: boolean; stock_qty: number; min_stock: number | null;
}
type Line = { productId: string | null; description: string; quantity: string; unitPrice: string; taxRate: string; exemptionCause: string };

const emptyLine = (): Line => ({ productId: null, description: "", quantity: "", unitPrice: "", taxRate: "21", exemptionCause: "" });
/** A blank quantity means one unit, a blank price means zero — so both fields
 *  can show their placeholder instead of a pre-filled value the user has to
 *  clear before typing. */
const qtyOf   = (v: string) => (v.trim() === "" ? 1 : (Number(v) || 0));
const priceOf = (v: string) => (Number(v) || 0);

const r2 = (n: number) => Math.round(n * 100) / 100;

function FacturacionScreenContent() {
  const { t } = useTranslation();
  const C = useColors();
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
  const [discountPct, setDiscountPct] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [exchangeRate, setExchangeRate] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [issuing, setIssuing] = useState(false);
  // Inline new client
  const [newClientOpen, setNewClientOpen] = useState(false);

  const selectedClient = companies.find(c => c.id === clientId);

  const clientMatches = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(c => c.name.toLowerCase().includes(q) || (c.cif ?? "").toLowerCase().includes(q));
  }, [companies, clientSearch]);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [{ data: inv }, { data: co }, { data: pr }] = await Promise.all([
      supabase.from("invoices").select("id, full_number, client_name, total, state, issue_date, kind, rectifies_invoice_id, verifactu_status, currency").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name, cif").eq("organization_id", orgId).eq("is_active", true).order("name"),
      supabase.from("products").select("id, name, unit_price, tax_rate, unit, track_stock, stock_qty, min_stock").eq("organization_id", orgId).eq("is_active", true).order("name"),
    ]);
    setInvoices((inv as Invoice[]) ?? []); setCompanies((co as Company[]) ?? []); setProducts((pr as Product[]) ?? []);
    setLoading(false); setRefreshing(false);
  }, [orgId]);

  useEffect(() => { if (paid) load(); else setLoading(false); }, [load, paid]);

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
    setClientId(""); setRetentionPct(""); setDiscountPct("");
    setCurrency(DEFAULT_CURRENCY); setExchangeRate("");
    setLines([emptyLine()]);
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

  const doIssue = async () => {
    setIssuing(true);
    try {
      const res = await fetch(`${APP_URL}/api/invoices/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          orgId, clientCompanyId: clientId, series: "FAC", kind: "ordinary",
          issueDate: new Date().toISOString().slice(0, 10), retentionPct: Number(retentionPct) || 0, discountPct: Number(discountPct) || 0,
          currency, exchangeRate: needsExchangeRate(currency) ? Number(exchangeRate) || null : null,
          lines: lines.filter(l => l.description.trim()).map(l => ({ productId: l.productId, description: l.description, quantity: qtyOf(l.quantity), unitPrice: priceOf(l.unitPrice), taxRate: Number(l.taxRate) || 0, discountPct: 0,
            exemptionCause: l.taxRate === "" ? l.exemptionCause : null })),
        }),
      });
      const json = await readJson(res);
      if (!res.ok) { Alert.alert(t("common.error"), json.detail ?? json.error ?? t("invoicing.errGeneric")); setIssuing(false); return; }
      setModal(false); resetForm(); await load();
      router.push(`/(app)/factura/${json.id}`);
    } catch (e) { Alert.alert(t("common.error"), String(e)); }
    setIssuing(false);
  };

  const issue = () => {
    if (!org?.cif?.trim()) { Alert.alert(t("common.error"), t("invoicing.errIssuerCif")); return; }
    if (!clientId) { Alert.alert(t("common.error"), t("invoicing.errClient")); return; }
    if (!selectedClient?.cif?.trim()) { Alert.alert(t("common.error"), t("invoicing.errClientCif")); return; }
    if (!lines.some(l => l.description.trim())) { Alert.alert(t("common.error"), t("invoicing.errLines")); return; }
    if (lines.some(l => l.taxRate === "" && l.description.trim() && !l.exemptionCause)) {
      Alert.alert(t("common.error"), t("invoicing.errExemptionCause")); return;
    }
    if (needsExchangeRate(currency) && !(Number(exchangeRate) > 0)) {
      Alert.alert(t("common.error"), t("invoicing.errExchangeRate", { currency })); return;
    }
    const warnings = getStockWarnings(
      lines.filter(l => l.description.trim()).map(l => ({ productId: l.productId, quantity: qtyOf(l.quantity) })),
      products,
    );
    if (warnings.length) { confirmStockWarnings(t, warnings, doIssue); return; }
    void doIssue();
  };

  const stateTone = (s: string): BadgeTone => s === "issued" ? "green" : s === "cancelled" ? "red" : "neutral";

  // An issued invoice that has been annulled must not keep reading "Emitida",
  // and its credit note should say what it is. Both are derived from the list
  // itself: the rectificative points at the invoice it cancels.
  const rectifiedIds = useMemo(
    () => new Set(invoices.map(i => i.rectifies_invoice_id).filter(Boolean) as string[]),
    [invoices],
  );
  const statusOf = (inv: Invoice): { label: string; tone: BadgeTone } => {
    if (inv.kind === "rectifying") return { label: t("invoicing.states.rectificative"), tone: "yellow" };
    if (rectifiedIds.has(inv.id))  return { label: t("invoicing.states.rectified"),     tone: "red" };
    return { label: t(`invoicing.states.${inv.state}`), tone: stateTone(inv.state) };
  };

  const Header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} strokeWidth={1.75} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text }}>{t("invoicing.title")}</Text>
      </View>
      {canManage && (
        <Button
          label={t("invoicing.new")}
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
          <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: C.text, textAlign: "center" }}>{t("invoicing.paywallTitle")}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted, textAlign: "center", marginTop: spacing.sm }}>{t("invoicing.paywallBody")}</Text>
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
          data={invoices} keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm + 2 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.blue} />}
          ListEmptyComponent={
            <EmptyState
              icon={<Receipt size={28} color={C.muted} strokeWidth={1.5} />}
              title={t("invoicing.empty")}
            />
          }
          renderItem={({ item }) => {
            const status = statusOf(item);
            return (
              <TouchableOpacity onPress={() => router.push(`/(app)/factura/${item.id}`)}>
                <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text }}>{item.full_number ?? "—"}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: 2 }}>{item.client_name ?? "—"} · {item.issue_date ?? ""}</Text>
                    {/* Un rechazo de la AEAT no puede quedarse solo en el detalle:
                        quien mira la lista tiene que ver que algo va mal. */}
                    {item.verifactu_status === "error" && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                        <AlertTriangle size={12} color={C.red} strokeWidth={1.75} />
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: C.red }}>{t("invoicing.aeatError")}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: C.text }}>{formatMoney(item.total, item.currency)}</Text>
                    <Badge label={status.label} tone={status.tone} />
                  </View>
                  <ChevronRight size={18} color={C.muted} strokeWidth={1.75} />
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* New invoice modal */}
      <KeyboardModal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: C.text }}>{t("invoicing.new")}</Text>
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

            {/* Lines */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted }}>{t("invoicing.lines")}</Text>
                <TouchableOpacity onPress={() => setLines([...lines, emptyLine()])}><Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.blue }}>+ {t("invoicing.addLine")}</Text></TouchableOpacity>
              </View>
              {lines.map((l, i) => (
                <Card key={i} containerStyle={{ marginBottom: spacing.sm + 2 }}>
                  {/* Editing the text must NOT unlink the product — the link drives
                      the automatic stock deduction at issue time. */}
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
                        // Leaving exempt drops the cause: keeping it would
                        // declare an exemption on a taxed line.
                        onPress={() => setLine(i, { taxRate: r, ...(r !== "" ? { exemptionCause: "" } : {}) })} C={C} />
                    ))}
                  </View>
                  {/* Only for an exempt line: the AEAT needs to know under
                      which article, and there is no safe default. */}
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

            {/* Moneda */}
            <View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted, marginBottom: spacing.sm }}>{t("invoicing.currency")}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {CURRENCIES.map(c => (
                  <Chip key={c.code} active={currency === c.code} label={c.code} onPress={() => { setCurrency(c.code); setExchangeRate(""); }} C={C} />
                ))}
              </View>
              {needsExchangeRate(currency) && (
                <Input placeholder={t("invoicing.exchangeRate", { currency })} keyboardType="decimal-pad"
                  value={exchangeRate} onChangeText={setExchangeRate}
                  style={{ marginTop: spacing.sm }} />
              )}
            </View>

            {/* Totals */}
            <Card style={{ gap: spacing.xs }}>
              <Row label={t("invoicing.subtotal")} value={formatMoney(totals.subtotal, currency)} C={C} />
              {totals.discount > 0 && <Row label={`${t("invoicing.discount")} (${discountPct}%)`} value={`−${formatMoney(totals.discount, currency)}`} C={C} />}
              <Row label={t("invoicing.iva")} value={formatMoney(totals.tax, currency)} C={C} />
              {totals.ret > 0 && <Row label={`${t("invoicing.retention")} (${retentionPct}%)`} value={`−${formatMoney(totals.ret, currency)}`} C={C} />}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
              <Row label={t("invoicing.total")} value={formatMoney(totals.total, currency)} C={C} bold />
            </Card>
          </ScrollView>

          <View style={{ padding: spacing.lg }}>
            <Button
              label={t("invoicing.issue")}
              onPress={issue}
              disabled={issuing}
              loading={issuing}
              icon={<ShieldCheck size={18} color="#fff" strokeWidth={1.75} />}
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
            {/* Type-to-search filter */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm + 2, marginBottom: spacing.sm + 2 }}>
              <SearchIcon size={15} color={C.muted} strokeWidth={1.75} />
              <TextInput placeholder={t("invoicing.searchClient")} placeholderTextColor={C.muted} value={clientSearch} onChangeText={setClientSearch} autoCorrect={false}
                style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 9, color: C.text }} />
              {clientSearch.length > 0 && (
                <TouchableOpacity onPress={() => setClientSearch("")} hitSlop={8}><X size={15} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
              )}
            </View>
            {/* Full "new client" form — a client created here is used on a
                legal invoice, so it asks for the address and the email too. */}
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

export default function FacturacionScreen() {
  return (
    <RequirePermission section="facturacion">
      <FacturacionScreenContent />
    </RequirePermission>
  );
}
