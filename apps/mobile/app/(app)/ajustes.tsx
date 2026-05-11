import { useState, useCallback, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Switch,
  Alert, ActivityIndicator, Clipboard, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  User, Building2, Copy, Check, Users, Globe, Moon,
  Bell, LogOut, ChevronRight, CreditCard, FileText,
  CheckCircle, AlertTriangle, XCircle, Clock, HelpCircle,
  Shield,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { setLanguage, type Lang } from "@/lib/i18n";

const C = {
  blue: "#2563EB", blueL: "#EFF6FF",
  green: "#16A34A", greenL: "#F0FDF4",
  red: "#DC2626",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
};

const ROLE_COLORS: Record<string, string> = {
  owner: C.blue, admin: C.green, member: "#D97706", viewer: C.muted,
};

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "700", color: C.muted, letterSpacing: 0.8, textTransform: "uppercase", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 }}>
      {children}
    </Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: C.surface, borderRadius: 14, marginHorizontal: 16, overflow: "hidden",
      shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    }}>
      {children}
    </View>
  );
}

function Row({
  icon, label, value, onPress, border = true, danger = false,
}: {
  icon?: React.ReactNode; label: string; value?: string | React.ReactNode;
  onPress?: () => void; border?: boolean; danger?: boolean;
}) {
  const content = (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
      borderBottomWidth: border ? 1 : 0, borderBottomColor: C.border,
    }}>
      {icon && <View style={{ width: 20, alignItems: "center" }}>{icon}</View>}
      <Text style={{ flex: 1, fontSize: 14, color: danger ? C.red : C.text }}>{label}</Text>
      {value != null && (
        typeof value === "string"
          ? <Text style={{ fontSize: 14, color: C.muted }}>{value}</Text>
          : value
      )}
      {onPress && !value && <ChevronRight size={16} color={C.muted} />}
    </View>
  );
  return onPress ? <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity> : content;
}

interface PlanInfo {
  subscription_status: string;
  extra_users_quantity: number;
  extra_docs_quantity: number;
  extra_companies_quantity: number;
  document_count: number;
  member_count: number;
  company_count: number;
}

const APP_URL = "https://archivum2704-dot.vercel.app";

function StatusIcon({ status }: { status: string }) {
  if (status === "active")   return <CheckCircle  size={14} color="#16A34A" />;
  if (status === "trialing") return <Clock        size={14} color="#2563EB" />;
  if (status === "past_due") return <AlertTriangle size={14} color="#D97706" />;
  return <XCircle size={14} color="#6B7280" />;
}

// statusLabel removed — translated inline via i18next (ajustes.plan.statuses.*)


function statusColor(s: string) {
  if (s === "active")   return "#16A34A";
  if (s === "trialing") return "#2563EB";
  if (s === "past_due") return "#D97706";
  return "#6B7280";
}

function isPaidActive(status: string) {
  return status === "active" || status === "trialing";
}

function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const color = pct >= 90 ? "#DC2626" : pct >= 70 ? "#D97706" : "#2563EB";
  return (
    <View style={{ height: 5, backgroundColor: "#E5E7EB", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
      <View style={{ height: 5, width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function AjustesScreen() {
  const { t, i18n } = useTranslation();
  const { profile, org, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [copied,        setCopied]        = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [signingOut,    setSigningOut]    = useState(false);
  const [plan,          setPlan]          = useState<PlanInfo | null>(null);

  // Fetch plan info on mount
  useEffect(() => {
    if (!org?.id) return;
    (async () => {
      const [{ data: orgData }, { count: memberCount }, { count: companyCount }] = await Promise.all([
        supabase.from("organizations")
          .select("subscription_status,extra_users_quantity,extra_docs_quantity,extra_companies_quantity,document_count")
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
        setPlan({ ...orgData, member_count: memberCount ?? 0, company_count: companyCount ?? 0 });
      }
    })();
  }, [org?.id]);

  const handleCopy = useCallback(() => {
    if (org?.access_code) {
      Clipboard.setString(org.access_code);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
          {t("ajustes.title")}
        </Text>

        {/* Profile card */}
        <View style={{ marginHorizontal: 16, marginBottom: 4 }}>
          <View style={{
            backgroundColor: C.surface, borderRadius: 14, padding: 16,
            flexDirection: "row", gap: 14, alignItems: "center",
            shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{fullName}</Text>
              <Text style={{ fontSize: 13, color: C.muted, marginTop: 1 }}>{profile?.id ? "owner" : ""}</Text>
            </View>
          </View>
        </View>

        {/* Organization */}
        <SectionLabel>{t("ajustes.sections.organization")}</SectionLabel>
        <Card>
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{t("ajustes.organization.name")}</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{org?.name ?? "—"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
            <View>
              <Text style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{t("ajustes.organization.accessCode")}</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: C.blue, fontFamily: "monospace", letterSpacing: 3 }}>
                {org?.access_code ?? "—"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleCopy}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8,
                backgroundColor: copied ? C.greenL : C.blueL,
                borderWidth: 1, borderColor: copied ? C.green : C.blue,
                borderRadius: 8,
              }}
            >
              {copied
                ? <><Check size={14} color={C.green} /><Text style={{ fontSize: 12, fontWeight: "600", color: C.green }}>{t("common.copied")}</Text></>
                : <><Copy  size={14} color={C.blue}  /><Text style={{ fontSize: 12, fontWeight: "600", color: C.blue }}>{t("common.copy")}</Text></>
              }
            </TouchableOpacity>
          </View>
        </Card>

        {/* Plan */}
        <SectionLabel>{t("ajustes.sections.billing")}</SectionLabel>
        <Card>
          {/* Status row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CreditCard size={16} color={C.muted} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{t("ajustes.plan.title")}</Text>
            </View>
            {plan ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: statusColor(plan.subscription_status) + "18", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }}>
                <StatusIcon status={plan.subscription_status} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: statusColor(plan.subscription_status) }}>
                  {t(`ajustes.plan.statuses.${plan.subscription_status}`, { defaultValue: plan.subscription_status })}
                </Text>
              </View>
            ) : (
              <ActivityIndicator size="small" color={C.blue} />
            )}
          </View>

          {/* Usage: users */}
          {plan && (
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Users size={14} color={C.muted} />
                  <Text style={{ fontSize: 13, color: C.muted }}>{t("ajustes.plan.users")}</Text>
                </View>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: "600" }}>
                  {plan.member_count} / {isPaidActive(plan.subscription_status) ? 5 + plan.extra_users_quantity : 1}
                </Text>
              </View>
              <UsageBar value={plan.member_count} max={isPaidActive(plan.subscription_status) ? 5 + plan.extra_users_quantity : 1} />
            </View>
          )}

          {/* Usage: documents */}
          {plan && (
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <FileText size={14} color={C.muted} />
                  <Text style={{ fontSize: 13, color: C.muted }}>{t("ajustes.plan.documents")}</Text>
                </View>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: "600" }}>
                  {plan.document_count} / {isPaidActive(plan.subscription_status) ? 500 + plan.extra_docs_quantity * 200 : 20}
                </Text>
              </View>
              <UsageBar value={plan.document_count} max={isPaidActive(plan.subscription_status) ? 500 + plan.extra_docs_quantity * 200 : 20} />
            </View>
          )}

          {/* Usage: companies */}
          {plan && (
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Building2 size={14} color={C.muted} />
                  <Text style={{ fontSize: 13, color: C.muted }}>{t("ajustes.plan.companies")}</Text>
                </View>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: "600" }}>
                  {plan.company_count} / {isPaidActive(plan.subscription_status) ? 20 + plan.extra_companies_quantity : 1}
                </Text>
              </View>
              <UsageBar value={plan.company_count} max={isPaidActive(plan.subscription_status) ? 20 + plan.extra_companies_quantity : 1} />
            </View>
          )}

          {/* Manage button */}
          <TouchableOpacity
            onPress={() => Linking.openURL(`${APP_URL}/configuracion/billing`)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}
          >
            <Text style={{ fontSize: 14, color: C.blue, fontWeight: "600" }}>{t("ajustes.plan.manage")}</Text>
            <ChevronRight size={16} color={C.blue} />
          </TouchableOpacity>
        </Card>

        {/* Preferences */}
        <SectionLabel>{t("ajustes.sections.preferences")}</SectionLabel>
        <Card>
          {/* Language */}
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Globe size={15} color={C.muted} />
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{t("ajustes.preferences.language")}</Text>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 8, padding: 2 }}>
              {LANGS.map((l) => {
                const active = currentLang === l.key;
                return (
                  <TouchableOpacity key={l.key} onPress={() => handleLangChange(l.key)} style={{
                    flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: "center",
                    backgroundColor: active ? C.surface : "transparent",
                    shadowColor: active ? "#000" : "transparent",
                    shadowOpacity: active ? 0.1 : 0, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: active ? 1 : 0,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: active ? "600" : "400", color: active ? C.blue : C.muted }}>{l.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Theme */}
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Moon size={15} color={C.muted} />
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{t("ajustes.preferences.theme")}</Text>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 8, padding: 2, gap: 2 }}>
              {THEMES.map((th) => {
                const active = theme === th.key;
                return (
                  <TouchableOpacity key={th.key} onPress={() => setTheme(th.key)} style={{
                    flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: "center",
                    backgroundColor: active ? C.surface : "transparent",
                    shadowColor: active ? "#000" : "transparent",
                    shadowOpacity: active ? 0.1 : 0, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: active ? 1 : 0,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: active ? "600" : "400", color: active ? C.blue : C.muted }}>{t(th.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Notifications */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Bell size={15} color={C.muted} />
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{t("ajustes.preferences.notifications")}</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#D1D5DB", true: C.blue }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Help */}
        <SectionLabel>{t("ajustes.sections.help")}</SectionLabel>
        <Card>
          <Row
            icon={<HelpCircle size={16} color={C.muted} />}
            label={t("ajustes.help.tutorial")}
            onPress={async () => {
              try { await AsyncStorage.removeItem("@archivum/onboarding_completed"); } catch {}
              router.push("/(app)/onboarding");
            }}
            border={false}
          />
        </Card>

        {/* Danger zone — cancel subscription */}
        <SectionLabel>Zona de peligro</SectionLabel>
        <Card>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "⚠️ Cancelar suscripción",
                [
                  "IMPORTANTE — Lee esto antes de continuar:",
                  "",
                  "1. Descarga todos tus documentos AHORA, porque una vez cancelada la suscripción no podrás acceder ni visualizar ningún documento.",
                  "",
                  "2. Si no renuevas en 15 días, tu cuenta y TODOS los datos (documentos, empresas, equipo) serán eliminados de forma permanente.",
                  "",
                  "3. Durante los 15 días de gracia no podrás subir, descargar ni editar documentos.",
                ].join(""),
                [
                  { text: "Mantener suscripción", style: "cancel" },
                  {
                    text: "Sí, cancelar", style: "destructive",
                    onPress: async () => {
                      if (!org?.id) return;
                      try {
                        await fetch("https://archivum2704-dot.vercel.app/api/billing/cancel", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ orgId: org.id }),
                        });
                        Alert.alert(
                          "Suscripción cancelada",
                          "Tu suscripción ha sido cancelada. Tienes 15 días para descargar tus documentos antes de que la cuenta sea eliminada.",
                          [{ text: "Entendido" }]
                        );
                      } catch {
                        Alert.alert("Error", "No se pudo cancelar la suscripción. Inténtalo desde la web.");
                      }
                    },
                  },
                ]
              );
            }}
            style={{ padding: 14 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={16} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: C.red, fontWeight: "600" }}>Cancelar suscripción</Text>
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  Los datos serán eliminados 15 días después de cancelar.
                </Text>
              </View>
              <ChevronRight size={16} color={C.red} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Sign out */}
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={signingOut}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              borderWidth: 1, borderColor: C.red, borderRadius: 10, paddingVertical: 14,
              opacity: signingOut ? 0.6 : 1,
            }}
          >
            {signingOut
              ? <ActivityIndicator size="small" color={C.red} />
              : <><LogOut size={18} color={C.red} /><Text style={{ color: C.red, fontWeight: "600", fontSize: 15 }}>{t("ajustes.signOut")}</Text></>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
