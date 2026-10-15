import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  Plus, Search, MoreVertical, Building2, X,
  FileText, Pencil, PauseCircle, PlayCircle, Trash2,
  Lock, Mail, Phone, MapPin,
} from "lucide-react-native";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import { isPaymentMethod } from "@/lib/payment-methods";
import { findSimilarClients, duplicateWarnings, cifTakenMessage, looksLikeSpanishTaxId, explainCompanyError, type ClientLike } from "@/lib/client-checks";
import { EstablishmentPicker, CifTakenNotice } from "@/components/EstablishmentPicker";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Coachmark } from "@/components/Coachmark";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { BillingNotice } from "@/components/BillingNotice";
import { RequirePermission } from "@/components/RequirePermission";
import { KeyboardModal } from "@/components/KeyboardModal";
import { resolveEntitlements } from "@/lib/pricing";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui";
import { hasRole, isClient, kindOf, withRole, type CompanyKind, type CompanyRole } from "@/lib/company-kind";



interface PlanInfo {
  subscription_plan: string;
  subscription_status: string;
  extra_companies_quantity: number;
}

interface Company {
  id: string;
  name: string;
  cif: string | null;
  sector: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  payment_method?: string | null;
  payment_due_days?: number | null;
  parent_company_id?: string | null;
  kind?: string | null;
  is_active: boolean;
  doc_count?: number;
}

type CompanyForm = {
  name: string; cif: string; sector: string; email: string; phone: string;
  address: string; postal_code: string; city: string; province: string;
  payment_method: string; payment_due_days: string; parent_company_id: string;
};

const toForm = (c?: Company | null): CompanyForm => ({
  name: c?.name ?? "", cif: c?.cif ?? "", sector: c?.sector ?? "",
  email: c?.email ?? "", phone: c?.phone ?? "", address: c?.address ?? "",
  postal_code: c?.postal_code ?? "", city: c?.city ?? "", province: c?.province ?? "",
  payment_method: c?.payment_method ?? "",
  payment_due_days: c?.payment_due_days != null ? String(c.payment_due_days) : "",
  parent_company_id: c?.parent_company_id ?? "",
});

// Sentinel for the "no sector" filter chip
const NO_SECTOR = "__no_sector__";

/* ── Upgrade modal ───────────────────────────────────────────────────────── */
function UpgradeModal({ visible, maxCompanies, onClose, C, t }: { visible: boolean; maxCompanies: number; onClose: () => void; C: any; t: any }) {
  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, paddingBottom: spacing.xl + 4 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.lg }} />
        <View style={{ alignItems: "center", marginBottom: spacing.md }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
            <Lock size={26} color={C.blue} strokeWidth={1.75} />
          </View>
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 18, color: C.text, textAlign: "center", paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
          {t("empresas.limitTitle")}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted, textAlign: "center", paddingHorizontal: spacing.xl, lineHeight: 20, marginBottom: spacing.xl - 4 }}>
          {t("empresas.limitDesc", { max: maxCompanies })}
        </Text>
        <View style={{ marginHorizontal: spacing.xl, marginBottom: spacing.xl - 4, gap: spacing.sm }}>
          {[t("empresas.limitBullet1"), t("empresas.limitBullet2"), t("empresas.limitBullet3")].map((line) => (
            <View key={line} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.blue }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.text }}>{line}</Text>
            </View>
          ))}
        </View>
        <BillingNotice style={{ marginHorizontal: spacing.xl }} />
        <TouchableOpacity onPress={onClose} style={{ marginTop: spacing.sm + 2, alignItems: "center", paddingVertical: spacing.sm + 2 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted }}>{t("common.notNow")}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardModal>
  );
}

/* ── Company form modal (create / edit) ─────────────────────────────────── */
/**
 * Same fields as the web client form (`empresas-view.tsx`). This one used to
 * ask only for name, CIF and sector, so a client created from here had no
 * address, phone or email — while the same client created from an invoice
 * (NewClientModal) did. Kept at module scope so fields keep focus while typing.
 */
function CompanyModal({
  visible, onClose, onSaved, orgId, role, initial, existing = [], C, t,
}: {
  visible: boolean; onClose: () => void; onSaved: () => void;
  orgId: string; role: CompanyRole; initial?: Company | null; existing?: Company[]; C: any; t: any;
}) {
  const ns = role === "supplier" ? "proveedores" : "empresas";
  const isEdit = !!initial;
  const [form, setForm] = useState<CompanyForm>(toForm(initial));
  const [saving, setSaving] = useState(false);
  // Client, supplier or both. A new one starts as what the list shows.
  const startKind = (): CompanyKind => initial ? kindOf(initial) : role;
  const [kind, setKind] = useState<CompanyKind>(startKind());
  const roles = { client: kind !== "supplier", supplier: kind !== "client" };
  const toggleRole = (r: CompanyRole) => {
    const next = { ...roles, [r]: !roles[r] };
    if (!next.client && !next.supplier) return;
    setKind(next.client && next.supplier ? "both" : next.supplier ? "supplier" : "client");
  };

  useEffect(() => {
    if (visible) { setForm(toForm(initial)); setKind(startKind()); }
  }, [visible, initial]);

  const set = (k: keyof CompanyForm) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  // CIF/NIF required and unique per organization, also when editing a client
  // created before it was (WEB-004). The database enforces both.
  const cifRequired = true;
  const cifMissing = !form.cif.trim();
  const similar = findSimilarClients(existing, { name: form.name, cif: form.cif, parentId: form.parent_company_id || null }, initial?.id);
  const hasEstablishments = !!initial && existing.some(c => c.parent_company_id === initial.id);
  // Filing it under a principal copies the principal's CIF, which then stays locked.
  const setPrincipal = (p: ClientLike | null) =>
    setForm(f => p ? { ...f, parent_company_id: p.id, cif: p.cif ?? f.cif } : { ...f, parent_company_id: "" });
  const warnings = duplicateWarnings(similar);
  // Same CIF as a company on file only as the other role: it gains this one
  // instead of a second record (the CIF is unique per organization).
  const otherRole = !isEdit && similar.sameCif && !hasRole(similar.sameCif, role) ? similar.sameCif : null;
  const cifTaken = cifTakenMessage(similar);
  const addRoleToExisting = async () => {
    if (!otherRole) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({ kind: withRole(otherRole, role) }).eq("id", otherRole.id);
    setSaving(false);
    if (error) { Alert.alert(t("common.error"), explainCompanyError(error, t("common.unknownError"))); return; }
    Alert.alert(t(`${ns}.addedRoleToast`, { name: otherRole.name }));
    onSaved();
    onClose();
  };
  const badFormat = !!form.cif.trim() && !looksLikeSpanishTaxId(form.cif);

  const handleSave = async () => {
    if (!form.name.trim() || cifMissing || cifTaken) return;
    setSaving(true);
    const dueDays = form.payment_due_days.trim() === ""
      ? null
      : Math.max(0, Math.min(365, Math.round(Number(form.payment_due_days)) || 0));
    const hadTerms = !!initial && (initial.payment_method != null || initial.payment_due_days != null);
    const payload = {
      name:        form.name.trim(),
      parent_company_id: form.parent_company_id || null,
      cif:         form.cif.trim()         || null,
      sector:      form.sector.trim()      || null,
      email:       form.email.trim()       || null,
      phone:       form.phone.trim()       || null,
      address:     form.address.trim()     || null,
      postal_code: form.postal_code.trim() || null,
      city:        form.city.trim()        || null,
      province:    form.province.trim()    || null,
      // Payment terms are only written when there is something to write (or
      // to clear), so the form keeps saving on a database where
      // 20260929_payment_terms.sql has not been applied yet.
      ...((form.payment_method || dueDays != null || hadTerms)
        ? { payment_method: form.payment_method || null, payment_due_days: dueDays }
        : {}),
      // Only written when not a plain client, or when it changes, so saving a
      // client keeps working before 20261015_company_kind.sql is applied.
      ...(kind !== (initial ? kindOf(initial) : "client") ? { kind } : {}),
    };
    let error: any;
    if (isEdit && initial) {
      ({ error } = await supabase.from("companies").update(payload).eq("id", initial.id));
    } else {
      ({ error } = await supabase.from("companies").insert({ organization_id: orgId, ...payload, is_active: true }));
    }
    setSaving(false);
    if (error) {
      Alert.alert(t("common.error"), explainCompanyError(error, t("common.unknownError")));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, maxHeight: "88%", overflow: "hidden" }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text }}>{isEdit ? t(`${ns}.editCompany`) : t(`${ns}.newCompany`)}</Text>
          <TouchableOpacity onPress={onClose} style={{ backgroundColor: C.segmentBg, borderRadius: radius.sm, padding: 6 }}>
            <X size={16} color={C.muted} strokeWidth={1.75} />
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Input label={t("empresas.nameLabel")} placeholder="Iberdrola SA" value={form.name} onChangeText={set("name")} />
          <EstablishmentPicker existing={existing} selfId={initial?.id} value={form.parent_company_id}
            onChange={setPrincipal} hasEstablishments={hasEstablishments} />
          <View style={{ flexDirection: "row", gap: spacing.sm + 2 }}>
            <View style={{ flex: 1 }}>
              <Input label={cifRequired ? `${t("empresas.cifLabel")} *` : t("empresas.cifLabel")} placeholder="A-95075578" value={form.cif} onChangeText={set("cif")} autoCapitalize="characters" editable={!form.parent_company_id} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label={t("empresas.sectorLabel")} placeholder="Energía" value={form.sector} onChangeText={set("sector")} />
            </View>
          </View>
          <Input label={t("invoicing.clientEmail")} placeholder="cliente@empresa.com" value={form.email} onChangeText={set("email")}
            keyboardType="email-address" autoCapitalize="none" />
          <Input label={t("invoicing.clientPhone")} placeholder="+34 600 000 000" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
          <Input label={t("invoicing.clientAddress")} placeholder="Calle Mayor 1" value={form.address} onChangeText={set("address")} />
          <View style={{ flexDirection: "row", gap: spacing.sm + 2 }}>
            <View style={{ flex: 1 }}>
              <Input label={t("invoicing.clientPostalCode")} placeholder="28001" value={form.postal_code} onChangeText={set("postal_code")} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label={t("invoicing.clientCity")} placeholder="Madrid" value={form.city} onChangeText={set("city")} />
            </View>
          </View>
          <Input label={t("invoicing.clientProvince")} placeholder="Madrid" value={form.province} onChangeText={set("province")} />
          <PaymentMethodPicker label={t("empresas.paymentMethod")} value={form.payment_method} onChange={set("payment_method")} />
          <Input label={t("empresas.paymentDueDays")} placeholder="30" value={form.payment_due_days} onChangeText={set("payment_due_days")}
            keyboardType="number-pad" hint={t(`${ns}.paymentDueDaysHint`)} />
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted }}>{t("empresas.roleLabel")}</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Chip label={t("empresas.roleClient")} active={roles.client} onPress={() => toggleRole("client")} C={C} />
              <Chip label={t("empresas.roleSupplier")} active={roles.supplier} onPress={() => toggleRole("supplier")} C={C} />
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("empresas.roleHint")}</Text>
          </View>
          {otherRole ? (
            <View style={{ backgroundColor: C.blueL, borderRadius: radius.md, padding: spacing.sm + 2, gap: spacing.sm }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.text }}>{t(`${ns}.existsWithOtherRole`, { name: otherRole.name })}</Text>
              <Button label={t(`${ns}.addRoleExisting`, { name: otherRole.name })} onPress={addRoleToExisting} disabled={saving} variant="secondary" size="md" />
            </View>
          ) : !!cifTaken && !!similar.sameCif && (
            <CifTakenNotice message={cifTaken} principal={similar.sameCif} onMakeEstablishment={() => setPrincipal(similar.sameCif)} />
          )}
          {isEdit && !initial?.cif?.trim() && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>{t(`${ns}.cifNowRequired`)}</Text>
          )}
          {warnings.map(w => (
            <View key={w} style={{ backgroundColor: C.yellowL, borderRadius: radius.md, padding: spacing.sm + 2 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.text }}>{w}</Text>
            </View>
          ))}
          {badFormat && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t(`${ns}.taxIdFormatHint`)}</Text>}
          <Button
            label={isEdit ? t("empresas.saveChanges") : t(`${ns}.createCompany`)}
            onPress={handleSave}
            disabled={saving || !form.name.trim() || cifMissing || !!cifTaken}
            loading={saving}
            style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}
          />
        </ScrollView>
      </View>
    </KeyboardModal>
  );
}

/* ── Action menu modal ───────────────────────────────────────────────────── */
function ActionMenu({
  visible, company, role, onClose, onEdit, onToggle, onDelete, onRemoveRole, C, t,
}: {
  visible: boolean; company: Company | null; role: CompanyRole; onClose: () => void;
  onEdit: () => void; onToggle: () => void; onDelete: () => void; onRemoveRole: () => void; C: any; t: any;
}) {
  if (!company) return null;
  const ns = role === "supplier" ? "proveedores" : "empresas";
  const both = kindOf(company) === "both";
  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, paddingBottom: spacing.xl }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.sm }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text, paddingHorizontal: spacing.xl - 4, paddingBottom: spacing.sm }} numberOfLines={1}>
          {company.name}
        </Text>
        {[
          { icon: <FileText size={18} color={C.blue} strokeWidth={1.75} />,   label: t(`${ns}.viewDocs`),     action: () => { onClose(); router.push(`/(app)/biblioteca?empresa=${company.id}${role === "supplier" ? "&tipo=compras" : ""}`); } },
          { icon: <Pencil size={18} color={C.text} strokeWidth={1.75} />,     label: t("common.edit"),         action: () => { onClose(); onEdit(); } },
          { icon: company.is_active
              ? <PauseCircle size={18} color={C.yellow} strokeWidth={1.75} />
              : <PlayCircle  size={18} color={C.green}  strokeWidth={1.75} />,
            label: company.is_active ? t("empresas.suspend") : t("empresas.reactivate"),
            action: () => { onClose(); onToggle(); }
          },
          // A company that is both keeps its record and only leaves this list.
          both
            ? { icon: <X size={18} color={C.text} strokeWidth={1.75} />, label: t(`${ns}.removeRole`), action: () => { onClose(); onRemoveRole(); }, danger: false }
            : { icon: <Trash2 size={18} color={C.red} strokeWidth={1.75} />, label: t("common.delete"), action: () => { onClose(); onDelete(); }, danger: true },
        ].map((item) => (
          <TouchableOpacity
            key={item.label} onPress={item.action}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md + 2, padding: spacing.md + 2, paddingHorizontal: spacing.xl - 4, borderBottomWidth: 1, borderBottomColor: C.border }}
          >
            {item.icon}
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: item.danger ? C.red : C.text }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </KeyboardModal>
  );
}

/* ── Filter chip ─────────────────────────────────────────────────────────── */
function Chip({ label, active, onPress, C }: { label: string; active: boolean; onPress: () => void; C: any }) {
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

/* ── Company card ────────────────────────────────────────────────────────── */
function CompanyCard({ company, all, ns, onMenu, C, t }: { company: Company; all: Company[]; ns: string; onMenu: () => void; C: any; t: any }) {
  const parent = company.parent_company_id ? all.find(c => c.id === company.parent_company_id) : null;
  const establishments = all.filter(c => c.parent_company_id === company.id).length;
  return (
    <Card
      padded={false}
      containerStyle={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm + 2 }}
    >
      {!company.is_active && <View style={{ height: 3, backgroundColor: C.yellow }} />}
      <View style={{ padding: spacing.md + 2 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", gap: spacing.sm + 2, alignItems: "center", flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.md - 2, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: C.blue }}>{company.name[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: spacing.xs + 2, alignItems: "center" }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text }} numberOfLines={1}>{company.name}</Text>
                {!company.is_active && <Badge label={t(`${ns}.suspended`)} tone="yellow" />}
              </View>
              {company.cif && (
                <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: C.muted }}>{company.cif}</Text>
              )}
              {!!parent && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.blue }} numberOfLines={1}>Establecimiento de {parent.name}</Text>
              )}
              {kindOf(company) === "both" && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t(`${ns}.otherRoleBadge`)}</Text>
              )}
              {!parent && establishments > 0 && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{establishments} establecimiento{establishments > 1 ? "s" : ""}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={onMenu} style={{ padding: 4 }}>
            <MoreVertical size={20} color={C.muted} strokeWidth={1.75} />
          </TouchableOpacity>
        </View>

        {(!!company.email || !!company.phone || !!company.city) && (
          <View style={{ gap: 3, marginTop: spacing.sm + 2 }}>
            {!!company.email && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Mail size={13} color={C.muted} strokeWidth={1.75} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.text, flex: 1 }} numberOfLines={1}>{company.email}</Text>
              </View>
            )}
            {!!company.phone && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Phone size={13} color={C.muted} strokeWidth={1.75} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.text }}>{company.phone}</Text>
              </View>
            )}
            {!!(company.address || company.city) && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MapPin size={13} color={C.muted} strokeWidth={1.75} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.text, flex: 1 }} numberOfLines={1}>
                  {[company.address, [company.postal_code, company.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm + 2, paddingTop: spacing.sm + 2, borderTopWidth: 1, borderTopColor: C.border }}>
          {company.sector && (
            <View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("empresas.sector")}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.text }}>{company.sector}</Text>
            </View>
          )}
          {(isPaymentMethod(company.payment_method) || company.payment_due_days != null) && (
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("empresas.paymentTerms")}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.text }} numberOfLines={1}>
                {[
                  isPaymentMethod(company.payment_method) ? t(`paymentMethods.${company.payment_method}`) : null,
                  company.payment_due_days != null ? t("empresas.daysSuffix", { days: company.payment_due_days }) : null,
                ].filter(Boolean).join(" · ")}
              </Text>
            </View>
          )}
          <View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("empresas.documents")}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.text }}>{company.doc_count ?? 0}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
function EmpresasScreenContent() {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId, isPlatformAdmin } = useAuth();
  // Clientes and Proveedores share this screen (lib/company-kind.ts);
  // `?tipo=proveedores` opens it on suppliers.
  const params = useLocalSearchParams<{ tipo?: string }>();
  const [role, setRole] = useState<CompanyRole>(params.tipo === "proveedores" ? "supplier" : "client");
  useEffect(() => { if (params.tipo === "proveedores") setRole("supplier"); }, [params.tipo]);
  const ns = role === "supplier" ? "proveedores" : "empresas";
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [filtered,     setFiltered]     = useState<Company[]>([]);
  const [query,        setQuery]        = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [menuTarget,   setMenuTarget]   = useState<Company | null>(null);
  const [editTarget,   setEditTarget]   = useState<Company | null>(null);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [upgradeOpen,  setUpgradeOpen]  = useState(false);
  const [plan,         setPlan]         = useState<PlanInfo | null>(null);

  // Same resolver the server enforces with.
  const maxCompanies = plan
    ? resolveEntitlements(plan, { isPlatformAdmin }).maxCompanies
    : 999; // Don't block while the plan is loading

  // The plan limits clients; suppliers do not count (20261015_company_kind.sql).
  const clientCount = companies.filter(isClient).length;
  const atLimit = plan != null && clientCount >= maxCompanies;
  const listed = companies.filter(c => hasRole(c, role));

  const handleAddPress = () => {
    if (!orgId) {
      Alert.alert(t("common.error"), t("common.unknownError"));
      return;
    }
    if (atLimit && role === "client") { setUpgradeOpen(true); }
    else         { setCreateOpen(true);  }
  };

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const [{ data: comps }, { data: counts }, { data: orgData }] = await Promise.all([
      supabase.from("companies").select("*").eq("organization_id", orgId).order("name"),
      supabase.from("documents").select("company_id").eq("organization_id", orgId).not("company_id", "is", null),
      supabase.from("organizations").select("subscription_plan, subscription_status, extra_companies_quantity").eq("id", orgId).single(),
    ]);
    const countMap: Record<string, number> = {};
    for (const row of counts ?? []) {
      if (row.company_id) countMap[row.company_id] = (countMap[row.company_id] ?? 0) + 1;
    }
    const withCounts = (comps ?? []).map((c) => ({ ...c, doc_count: countMap[c.id] ?? 0 }));
    setCompanies(withCounts);
    if (orgData) setPlan(orgData as PlanInfo);
    setLoading(false);
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const sectors = Array.from(
    new Set(listed.map((c) => c.sector?.trim()).filter((s): s is string => !!s))
  ).sort((a, b) => a.localeCompare(b));
  const hasNoSector = listed.some((c) => !c.sector?.trim());

  useEffect(() => {
    const q = query.trim().toLowerCase();
    setFiltered(
      companies.filter((c) => {
        if (!hasRole(c, role)) return false;
        const matchesSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.cif ?? "").toLowerCase().includes(q) ||
          (c.sector ?? "").toLowerCase().includes(q);
        const matchesSector =
          !selectedSector ||
          (selectedSector === NO_SECTOR ? !c.sector?.trim() : c.sector?.trim() === selectedSector);
        return matchesSearch && matchesSector;
      })
    );
  }, [query, companies, selectedSector, role]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleToggle = async (c: Company) => {
    await supabase.from("companies").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  const handleRemoveRole = async (c: Company) => {
    const { error } = await supabase.from("companies").update({ kind: role === "supplier" ? "client" : "supplier" }).eq("id", c.id);
    if (error) Alert.alert(t("common.error"), explainCompanyError(error, t("common.unknownError")));
    else Alert.alert(t(`${ns}.removedRoleToast`, { name: c.name }));
    load();
  };

  const handleDelete = (c: Company) => {
    // Deleting a principal would turn its establishments into principals
    // with a repeated CIF, which the database refuses.
    const children = companies.filter(x => x.parent_company_id === c.id).length;
    if (children) {
      Alert.alert(t("common.error"), `«${c.name}» tiene ${children} establecimiento(s): elimínalos o asígnalos a otro cliente antes de borrarlo.`);
      return;
    }
    Alert.alert(
      t(`${ns}.deleteTitle`),
      t(`${ns}.deleteConfirm`, { name: c.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"), style: "destructive",
          onPress: async () => { await supabase.from("companies").delete().eq("id", c.id); load(); },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <View>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text }}>{t(`${ns}.title`)}</Text>
            {plan && role === "client" && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: atLimit ? C.red : C.muted, marginTop: 1 }}>
                {t("empresas.companiesCount", { current: clientCount, max: maxCompanies })}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleAddPress}
            style={{ width: 36, height: 36, backgroundColor: C.blue, borderRadius: radius.md - 2, alignItems: "center", justifyContent: "center" }}
          >
            <Plus size={18} color="#fff" strokeWidth={1.75} />
          </TouchableOpacity>
        </View>

        {/* Clientes / Proveedores */}
        <View style={{ flexDirection: "row", backgroundColor: C.segmentBg, borderRadius: radius.md, padding: 3, marginBottom: spacing.sm + 2 }}>
          {(["client", "supplier"] as const).map(r => (
            <TouchableOpacity key={r} onPress={() => { setRole(r); setSelectedSector(null); }}
              style={{ flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: radius.md - 3, backgroundColor: role === r ? C.surface : "transparent" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: role === r ? C.text : C.muted }}>
                {t(r === "client" ? "empresas.segmentClients" : "empresas.segmentSuppliers")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{
          flexDirection: "row", alignItems: "center", gap: spacing.sm,
          backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border, borderRadius: radius.md, paddingHorizontal: spacing.md,
        }}>
          <Search size={16} color={C.muted} strokeWidth={1.75} />
          <TextInput
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: C.text, paddingVertical: spacing.sm + 2 }}
            placeholder={t(`${ns}.searchPlaceholder`)}
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}><X size={16} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
          )}
        </View>

        {/* Sector filter chips */}
        {sectors.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -spacing.lg, marginTop: spacing.sm + 2 }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 6 }}
          >
            <Chip label={t("empresas.allSectors")} active={selectedSector === null} onPress={() => setSelectedSector(null)} C={C} />
            {sectors.map((s) => (
              <Chip key={s} label={s} active={selectedSector === s} onPress={() => setSelectedSector(s)} C={C} />
            ))}
            {hasNoSector && (
              <Chip label={t("empresas.noSector")} active={selectedSector === NO_SECTOR} onPress={() => setSelectedSector(NO_SECTOR)} C={C} />
            )}
          </ScrollView>
        )}
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon={<Building2 size={28} color={C.muted} strokeWidth={1.5} />}
            title={(query || selectedSector) ? t("empresas.noResults") : t(`${ns}.noCompanies`)}
            subtitle={(query || selectedSector) ? t("empresas.tryOther") : t(`${ns}.addFirst`)}
            action={!query && !selectedSector ? (
              <Button label={t(`${ns}.addCompany`)} onPress={handleAddPress} size="md" fullWidth={false} />
            ) : undefined}
          />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CompanyCard company={item} all={companies} ns={ns} onMenu={() => setMenuTarget(item)} C={C} t={t} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
          contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* First-time hint */}
      <Coachmark
        id="empresas-create-first"
        active={!loading && role === "client" && listed.length === 0}
        icon={<Building2 size={32} color={C.blue} />}
        title={t("coachmarks.empresasCreateFirst.title")}
        description={t("coachmarks.empresasCreateFirst.description")}
        position="bottom"
      />

      {/* Modals */}
      <UpgradeModal visible={upgradeOpen} maxCompanies={maxCompanies} onClose={() => setUpgradeOpen(false)} C={C} t={t} />
      <CompanyModal visible={createOpen} role={role} existing={companies} onClose={() => setCreateOpen(false)} onSaved={load} orgId={orgId!} C={C} t={t} />
      <CompanyModal visible={!!editTarget} role={role} initial={editTarget} existing={companies} onClose={() => setEditTarget(null)} onSaved={load} orgId={orgId!} C={C} t={t} />
      <ActionMenu
        visible={!!menuTarget} company={menuTarget} role={role} onClose={() => setMenuTarget(null)}
        onEdit={() => { setEditTarget(menuTarget); setMenuTarget(null); }}
        onToggle={() => { if (menuTarget) handleToggle(menuTarget); setMenuTarget(null); }}
        onDelete={() => { if (menuTarget) handleDelete(menuTarget); }}
        onRemoveRole={() => { if (menuTarget) handleRemoveRole(menuTarget); }}
        C={C} t={t}
      />
    </SafeAreaView>
  );
}

export default function EmpresasScreen() {
  return (
    <RequirePermission section="empresas">
      <EmpresasScreenContent />
    </RequirePermission>
  );
}
