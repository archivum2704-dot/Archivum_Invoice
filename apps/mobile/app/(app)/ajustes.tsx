import { useState, useCallback, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Switch,
  Alert, ActivityIndicator, Linking, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Building2, Copy, Check, Users, Globe, Moon,
  Bell, LogOut, ChevronRight, CreditCard, FileText,
  CheckCircle, AlertTriangle, XCircle, Clock, HelpCircle, Info,
  ShieldCheck, Pencil, X, ImageOff, Upload, Trash2,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { setLanguage, type Lang } from "@/lib/i18n";
import { useColors, type Colors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { useShadows } from "@/lib/shadows";
import { BillingNotice } from "@/components/BillingNotice";
import { APP_URL } from "@/lib/config";
import { PLANS, type PlanId } from "@/lib/pricing";
import { parseApiResponse } from "@/lib/api";
import { KeyboardModal } from "@/components/KeyboardModal";
import { Button, Card, Badge, Input, type BadgeTone } from "@/components/ui";

function SectionLabel({ children, C }: { children: string; C: Colors }) {
  return (
    <Text style={{
      fontFamily: fonts.semibold, fontSize: 12, color: C.muted, letterSpacing: 0.8, textTransform: "uppercase",
      paddingHorizontal: spacing.lg, paddingTop: spacing.xl - 4, paddingBottom: spacing.sm - 2,
    }}>
      {children}
    </Text>
  );
}

function Row({
  icon, label, value, onPress, border = true, danger = false, C,
}: {
  icon?: React.ReactNode; label: string; value?: string | React.ReactNode;
  onPress?: () => void; border?: boolean; danger?: boolean; C: Colors;
}) {
  const content = (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md + 2,
      borderBottomWidth: border ? 1 : 0, borderBottomColor: C.border,
    }}>
      {icon && <View style={{ width: 20, alignItems: "center" }}>{icon}</View>}
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: danger ? C.red : C.text }}>{label}</Text>
      {value != null && (
        typeof value === "string"
          ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted }}>{value}</Text>
          : value
      )}
      {onPress && !value && <ChevronRight size={16} color={C.muted} strokeWidth={1.75} />}
    </View>
  );
  return onPress ? <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity> : content;
}

/* ── Organization fiscal data + logo editor (admins only) ─────────────────── */
interface OrgDraft {
  name: string; cif: string; phone: string; email: string;
  address: string; postal_code: string; city: string; province: string;
  logo_url: string | null;
}

function OrgEditModal({ visible, orgId, token, onClose, onSaved, C }: {
  visible: boolean; orgId: string; token: string | undefined;
  onClose: () => void; onSaved: () => void; C: Colors;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<OrgDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(null);
    supabase.from("organizations")
      .select("name, cif, phone, email, address, postal_code, city, province, logo_url")
      .eq("id", orgId).single()
      .then(({ data }) => {
        if (data) setDraft({
          name: data.name ?? "", cif: data.cif ?? "", phone: data.phone ?? "", email: data.email ?? "",
          address: data.address ?? "", postal_code: data.postal_code ?? "", city: data.city ?? "",
          province: data.province ?? "", logo_url: data.logo_url ?? null,
        });
      });
  }, [visible, orgId]);

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("organizations").update({
      name: draft.name.trim(),
      cif: draft.cif.trim() || null,
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      address: draft.address.trim() || null,
      postal_code: draft.postal_code.trim() || null,
      city: draft.city.trim() || null,
      province: draft.province.trim() || null,
    }).eq("id", orgId);
    setSaving(false);
    if (error) { Alert.alert(t("common.error"), error.message); return; }
    onSaved(); onClose();
  };

  const pickLogo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setLogoBusy(true);
    try {
      // Uploaded natively rather than with fetch + FormData: React Native has
      // to stream the picked file itself there, and on Android that failed
      // outright with "Network request failed". uploadAsync builds the
      // multipart body in native code from the file URI.
      const res2 = await FileSystem.uploadAsync(`${APP_URL}/api/organizations/logo`, asset.uri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType: asset.mimeType ?? "image/jpeg",
        parameters: { orgId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = parseApiResponse(res2.status, res2.body);
      if (res2.status < 200 || res2.status >= 300) {
        Alert.alert(t("common.error"), json.detail ?? json.error ?? `HTTP ${res2.status}`);
        return;
      }
      setDraft(d => d ? { ...d, logo_url: json.url } : d);
      onSaved();
    } catch (e) {
      Alert.alert(t("common.error"), String(e));
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      const r = await fetch(`${APP_URL}/api/organizations/logo`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ orgId }),
      });
      if (r.ok) { setDraft(d => d ? { ...d, logo_url: null } : d); onSaved(); }
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <KeyboardModal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: C.text }}>{t("ajustes.organization.editTitle")}</Text>
          <TouchableOpacity onPress={onClose}><X size={24} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
        </View>
        {!draft ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
              {/* Logo */}
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: C.muted, marginBottom: spacing.sm - 2 }}>{t("ajustes.organization.logo")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg }}>
                <View style={{ width: 56, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.inputBg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {draft.logo_url
                    ? <Image source={{ uri: draft.logo_url }} style={{ width: 56, height: 56 }} resizeMode="contain" />
                    : <ImageOff size={20} color={C.muted} strokeWidth={1.75} />}
                </View>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  loading={logoBusy}
                  onPress={pickLogo}
                  icon={<Upload size={15} color={C.text} strokeWidth={1.75} />}
                  label={draft.logo_url ? t("ajustes.organization.changeLogo") : t("ajustes.organization.uploadLogo")}
                />
                {!!draft.logo_url && (
                  <TouchableOpacity onPress={removeLogo} disabled={logoBusy} hitSlop={8}>
                    <Trash2 size={17} color={C.red} strokeWidth={1.75} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: -10, marginBottom: spacing.md + 2 }}>{t("ajustes.organization.logoHint")}</Text>

              <View style={{ marginBottom: spacing.md }}>
                <Input label={t("ajustes.organization.name")} value={draft.name} onChangeText={v => setDraft({ ...draft, name: v })} />
              </View>
              <View style={{ marginBottom: spacing.md }}>
                <Input label="CIF/NIF" value={draft.cif} onChangeText={v => setDraft({ ...draft, cif: v })} autoCapitalize="characters" />
              </View>
              <View style={{ marginBottom: spacing.md }}>
                <Input label={t("ajustes.organization.phone")} value={draft.phone} onChangeText={v => setDraft({ ...draft, phone: v })} keyboardType="phone-pad" />
              </View>
              <View style={{ marginBottom: spacing.md }}>
                <Input label={t("ajustes.organization.email")} value={draft.email} onChangeText={v => setDraft({ ...draft, email: v })} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={{ marginBottom: spacing.md }}>
                <Input label={t("ajustes.organization.address")} value={draft.address} onChangeText={v => setDraft({ ...draft, address: v })} />
              </View>
              <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }}>
                <View style={{ flex: 1 }}><Input label={t("ajustes.organization.postalCode")} value={draft.postal_code} onChangeText={v => setDraft({ ...draft, postal_code: v })} /></View>
                <View style={{ flex: 2 }}><Input label={t("ajustes.organization.city")} value={draft.city} onChangeText={v => setDraft({ ...draft, city: v })} /></View>
              </View>
              <Input label={t("ajustes.organization.province")} value={draft.province} onChangeText={v => setDraft({ ...draft, province: v })} />
            </ScrollView>
            <View style={{ padding: spacing.lg }}>
              <Button
                label={t("common.save")}
                onPress={save}
                loading={saving}
                disabled={!draft.name.trim()}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </KeyboardModal>
  );
}

interface PlanInfo {
  subscription_plan: PlanId;
  subscription_status: string;
  extra_users_quantity: number;
  extra_docs_quantity: number;
  extra_companies_quantity: number;
  doc_quota_pool: number;
  document_count: number;
  member_count: number;
  company_count: number;
}


function StatusIcon({ status, C }: { status: string; C: Colors }) {
  if (status === "active")   return <CheckCircle  size={14} color={C.green} strokeWidth={1.75} />;
  if (status === "trialing") return <Clock        size={14} color={C.blue} strokeWidth={1.75} />;
  if (status === "past_due") return <AlertTriangle size={14} color={C.yellow} strokeWidth={1.75} />;
  return <XCircle size={14} color={C.muted} strokeWidth={1.75} />;
}

function statusTone(s: string): BadgeTone {
  if (s === "active")   return "green";
  if (s === "trialing") return "blue";
  if (s === "past_due") return "yellow";
  return "neutral";
}

function UsageBar({ value, max, C }: { value: number; max: number; C: Colors }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const color = pct >= 90 ? C.red : pct >= 70 ? C.yellow : C.blue;
  return (
    <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3, marginTop: spacing.sm - 2, overflow: "hidden" }}>
      <View style={{ height: 5, width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function AjustesScreen() {
  const { t, i18n } = useTranslation();
  const { profile, org, signOut, session, isAdmin, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const C = useColors();
  const shadows = useShadows();
  const [copied,        setCopied]        = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [signingOut,    setSigningOut]    = useState(false);
  const [plan,          setPlan]          = useState<PlanInfo | null>(null);
  const [orgEditOpen,   setOrgEditOpen]   = useState(false);

  // Load notifications preference
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem("@archivum/notifications");
        if (v !== null) setNotifications(v === "true");
      } catch {}
    })();
  }, []);

  const toggleNotifications = async (val: boolean) => {
    setNotifications(val);
    try { await AsyncStorage.setItem("@archivum/notifications", String(val)); } catch {}
  };

  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      const [{ data: orgData }, { count: memberCount }, { count: companyCount }] = await Promise.all([
        supabase.from("organizations")
          .select("subscription_plan,subscription_status,extra_users_quantity,extra_docs_quantity,extra_companies_quantity,doc_quota_pool,document_count")
          .eq("id", org.id)
          .single(),
        supabase.from("organization_members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id),
        supabase.from("companies")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id),
      ]);
      if (orgData) {
        setPlan({
          ...orgData,
          subscription_plan: (orgData.subscription_plan ?? "free") as PlanId,
          member_count: memberCount ?? 0,
          company_count: companyCount ?? 0,
        });
      }
    })();
  }, [org?.id]);

  const handleCopy = useCallback(async () => {
    if (org?.access_code) {
      await Clipboard.setStringAsync(org.access_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [org?.access_code]);

  const handleSignOut = () => {
    Alert.alert(
      t("ajustes.signOutConfirmTitle"),
      t("ajustes.signOutConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("ajustes.signOut"), style: "destructive",
          onPress: async () => { setSigningOut(true); await signOut(); },
        },
      ]
    );
  };

  const firstName = profile?.first_name ?? "";
  const lastName  = profile?.last_name  ?? "";
  const fullName  = [firstName, lastName].filter(Boolean).join(" ") || t("ajustes.user");
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "U";

  const THEMES: { key: "light" | "dark" | "system"; labelKey: string }[] = [
    { key: "light",  labelKey: "ajustes.preferences.themeLight" },
    { key: "dark",   labelKey: "ajustes.preferences.themeDark" },
    { key: "system", labelKey: "ajustes.preferences.themeSystem" },
  ];
  const LANGS: { key: Lang; label: string }[] = [
    { key: "es", label: t("language.es") },
    { key: "en", label: t("language.en") },
  ];
  const currentLang = (i18n.language?.split("-")[0] as Lang) ?? "es";

  const handleLangChange = async (key: Lang) => {
    await setLanguage(key);
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg }}>
          {t("ajustes.title")}
        </Text>

        {/* Profile card */}
        <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.xs }}>
          <Card>
            <View style={{ flexDirection: "row", gap: spacing.md + 2, alignItems: "center" }}>
              {org?.logo_url ? (
                <Image
                  source={{ uri: org.logo_url }}
                  style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: C.border }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 20, color: "#fff" }}>{initials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: C.text }}>{fullName}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted, marginTop: 1 }}>{profile?.id ? "owner" : ""}</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Organization */}
        <SectionLabel C={C}>{t("ajustes.sections.organization")}</SectionLabel>
        <View style={{ marginHorizontal: spacing.lg }}>
          <Card padded={false}>
            <View style={{ padding: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginBottom: 2 }}>{t("ajustes.organization.name")}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: C.text }}>{org?.name ?? "—"}</Text>
            </View>
            {isAdmin && (
              <TouchableOpacity onPress={() => setOrgEditOpen(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, padding: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Pencil size={15} color={C.blue} strokeWidth={1.75} />
                <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: C.blue }}>{t("ajustes.organization.editTitle")}</Text>
                <ChevronRight size={16} color={C.blue} strokeWidth={1.75} />
              </TouchableOpacity>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md + 2 }}>
              <View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginBottom: 2 }}>{t("ajustes.organization.accessCode")}</Text>
                <Text style={{ fontFamily: fonts.mono, fontWeight: "700", fontSize: 18, color: C.blue, letterSpacing: 3 }}>
                  {org?.access_code ?? "—"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCopy}
                style={{
                  flexDirection: "row", alignItems: "center", gap: spacing.xs + 2, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm,
                  backgroundColor: copied ? C.greenL : C.blueL,
                  borderWidth: 1, borderColor: copied ? C.green : C.blue,
                  borderRadius: radius.sm,
                }}
              >
                {copied
                  ? <><Check size={14} color={C.green} strokeWidth={1.75} /><Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.green }}>{t("common.copied")}</Text></>
                  : <><Copy  size={14} color={C.blue}  strokeWidth={1.75} /><Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.blue }}>{t("common.copy")}</Text></>
                }
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Plan */}
        <SectionLabel C={C}>{t("ajustes.sections.billing")}</SectionLabel>
        <View style={{ marginHorizontal: spacing.lg }}>
          <Card padded={false}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <CreditCard size={16} color={C.muted} strokeWidth={1.75} />
                <View>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: C.text }}>
                    {plan ? `Plan ${PLANS[plan.subscription_plan].name}` : t("ajustes.plan.title")}
                  </Text>
                  {plan && (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: 1 }}>
                      {PLANS[plan.subscription_plan].price === 0 ? t("ajustes.plan.freeForever") : PLANS[plan.subscription_plan].priceLabel}
                    </Text>
                  )}
                </View>
              </View>
              {plan ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <StatusIcon status={plan.subscription_status} C={C} />
                  <Badge
                    label={t(`ajustes.plan.statuses.${plan.subscription_status}`, { defaultValue: plan.subscription_status })}
                    tone={statusTone(plan.subscription_status)}
                  />
                </View>
              ) : (
                <ActivityIndicator size="small" color={C.blue} />
              )}
            </View>

            {/* Usage: documents */}
            {plan && (() => {
              const planData = PLANS[plan.subscription_plan];
              const baseMonthly = planData.docsPerMonth;
              const bonusDocs = plan.extra_docs_quantity * 200;
              const totalPool = plan.doc_quota_pool;
              const usedApprox = Math.max(0, baseMonthly + bonusDocs - totalPool);
              return (
                <View style={{ padding: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm - 2 }}>
                      <FileText size={14} color={C.muted} strokeWidth={1.75} />
                      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted }}>{t("ajustes.plan.docsAvailable")}</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.text }}>
                      {t("ajustes.plan.remaining", { count: totalPool.toLocaleString() })}
                    </Text>
                  </View>
                  <UsageBar C={C} value={usedApprox} max={baseMonthly + bonusDocs} />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: spacing.xs }}>
                    {t("ajustes.plan.baseMonthly", { count: baseMonthly })}{bonusDocs > 0 ? t("ajustes.plan.bonusDocs", { count: bonusDocs }) : ""}
                  </Text>
                </View>
              );
            })()}

            {/* Usage: users */}
            {plan && (() => {
              const maxUsers = PLANS[plan.subscription_plan].users + plan.extra_users_quantity;
              return (
                <View style={{ padding: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm - 2 }}>
                      <Users size={14} color={C.muted} strokeWidth={1.75} />
                      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted }}>{t("ajustes.plan.users")}</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.text }}>
                      {plan.member_count} / {maxUsers}
                    </Text>
                  </View>
                  <UsageBar C={C} value={plan.member_count} max={maxUsers} />
                </View>
              );
            })()}

            {/* Usage: companies */}
            {plan && (
              <View style={{ padding: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm - 2 }}>
                    <Building2 size={14} color={C.muted} strokeWidth={1.75} />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted }}>{t("ajustes.plan.companies")}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.text }}>
                    {plan.company_count} {t("ajustes.plan.companies").toLowerCase()}
                    {plan.extra_companies_quantity > 0 ? ` (+${plan.extra_companies_quantity} extra)` : ""}
                  </Text>
                </View>
              </View>
            )}

            <BillingNotice style={{ margin: spacing.md + 2 }} />
          </Card>
        </View>

        {/* Preferences */}
        <SectionLabel C={C}>{t("ajustes.sections.preferences")}</SectionLabel>
        <View style={{ marginHorizontal: spacing.lg }}>
          <Card padded={false}>
            <View style={{ padding: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm - 2, marginBottom: spacing.sm }}>
                <Globe size={15} color={C.muted} strokeWidth={1.75} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text }}>{t("ajustes.preferences.language")}</Text>
              </View>
              <View style={{ flexDirection: "row", backgroundColor: C.segmentBg, borderRadius: radius.md, padding: 3 }}>
                {LANGS.map((l) => {
                  const active = currentLang === l.key;
                  return (
                    <TouchableOpacity key={l.key} onPress={() => handleLangChange(l.key)} style={[
                      {
                        flex: 1, paddingVertical: spacing.sm - 1, borderRadius: radius.md - 3, alignItems: "center",
                        backgroundColor: active ? C.surface : "transparent",
                      },
                      active ? shadows.sm : null,
                    ]}>
                      <Text style={{ fontFamily: active ? fonts.semibold : fonts.regular, fontSize: 13, color: active ? C.blue : C.muted }}>{l.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ padding: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm - 2, marginBottom: spacing.sm }}>
                <Moon size={15} color={C.muted} strokeWidth={1.75} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text }}>{t("ajustes.preferences.theme")}</Text>
              </View>
              <View style={{ flexDirection: "row", backgroundColor: C.segmentBg, borderRadius: radius.md, padding: 3, gap: 2 }}>
                {THEMES.map((th) => {
                  const active = theme === th.key;
                  return (
                    <TouchableOpacity key={th.key} onPress={() => setTheme(th.key)} style={[
                      {
                        flex: 1, paddingVertical: spacing.sm - 1, borderRadius: radius.md - 3, alignItems: "center",
                        backgroundColor: active ? C.surface : "transparent",
                      },
                      active ? shadows.sm : null,
                    ]}>
                      <Text style={{ fontFamily: active ? fonts.semibold : fonts.regular, fontSize: 12, color: active ? C.blue : C.muted }}>{t(th.labelKey)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md + 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm - 2 }}>
                <Bell size={15} color={C.muted} strokeWidth={1.75} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text }}>{t("ajustes.preferences.notifications")}</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={toggleNotifications}
                trackColor={{ false: C.border, true: C.blue }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>
        </View>

        {/* Legal.
            Art. 13.2 requires the declaration to be visible in the system
            itself. It opens in the browser rather than being duplicated as a
            screen: one source, so the two can never disagree about what the
            system declares. */}
        <SectionLabel C={C}>{t("ajustes.sections.legal")}</SectionLabel>
        <View style={{ marginHorizontal: spacing.lg }}>
          <Card padded={false}>
            <Row
              C={C}
              icon={<ShieldCheck size={16} color={C.muted} strokeWidth={1.75} />}
              label={t("ajustes.legal.declaration")}
              onPress={() => Linking.openURL(`${APP_URL}/declaracion-responsable`)}
              border={false}
            />
          </Card>
        </View>

        {/* Help */}
        <SectionLabel C={C}>{t("ajustes.sections.help")}</SectionLabel>
        <View style={{ marginHorizontal: spacing.lg }}>
          <Card padded={false}>
            <Row
              C={C}
              icon={<HelpCircle size={16} color={C.muted} strokeWidth={1.75} />}
              label={t("ajustes.help.tutorial")}
              onPress={async () => {
                try { await AsyncStorage.removeItem("@archivum/onboarding_completed"); } catch {}
                router.push("/(app)/onboarding");
              }}
            />
            {/* Which build is installed. Device-only bugs are impossible to chase
                when a tester and I cannot tell two APKs apart. */}
            <Row
              C={C}
              icon={<Info size={16} color={C.muted} strokeWidth={1.75} />}
              label={t("ajustes.help.version")}
              value={`${Constants.expoConfig?.version ?? "?"} (${Constants.expoConfig?.extra?.buildLabel ?? "dev"})`}
              border={false}
            />
          </Card>
        </View>

        {/* Danger zone */}
        <SectionLabel C={C}>{t("ajustes.sections.danger")}</SectionLabel>
        <View style={{ marginHorizontal: spacing.lg }}>
          <Card padded={false}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  t("ajustes.cancelSub.title"),
                  t("ajustes.cancelSub.warning"),
                  [
                    { text: t("ajustes.cancelSub.keep"), style: "cancel" },
                    {
                      text: t("ajustes.cancelSub.confirm"), style: "destructive",
                      onPress: async () => {
                        if (!org?.id) return;
                        try {
                          await fetch(`${APP_URL}/api/billing/cancel`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
                            },
                            body: JSON.stringify({ orgId: org.id }),
                          });
                          Alert.alert(t("ajustes.cancelSub.done"), t("ajustes.cancelSub.doneDesc"), [{ text: t("common.gotIt") }]);
                        } catch {
                          Alert.alert(t("common.error"), t("ajustes.cancelSub.error"));
                        }
                      },
                    },
                  ]
                );
              }}
              style={{ padding: spacing.md + 2 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
                <AlertTriangle size={16} color={C.red} strokeWidth={1.75} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: C.red }}>{t("ajustes.cancelSub.title")}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {t("ajustes.cancelSub.subtitle")}
                  </Text>
                </View>
                <ChevronRight size={16} color={C.red} strokeWidth={1.75} />
              </View>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Sign out */}
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Button
            label={t("ajustes.signOut")}
            onPress={handleSignOut}
            variant="danger"
            loading={signingOut}
            icon={<LogOut size={18} color="#fff" strokeWidth={1.75} />}
          />
        </View>
      </ScrollView>

      {org?.id && (
        <OrgEditModal
          visible={orgEditOpen}
          orgId={org.id}
          token={session?.access_token}
          onClose={() => setOrgEditOpen(false)}
          onSaved={refreshProfile}
          C={C}
        />
      )}
    </SafeAreaView>
  );
}
