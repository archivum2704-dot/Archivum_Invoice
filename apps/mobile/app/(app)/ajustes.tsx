import { useState, useCallback, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Switch,
  Alert, ActivityIndicator, Clipboard, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User, Building2, Copy, Check, Users, Globe, Moon,
  Bell, LogOut, ChevronRight, CreditCard, FileText, Zap,
  CheckCircle, AlertTriangle, XCircle, Clock,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";
import { supabase } from "@/lib/supabase";

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
  document_count: number;
  member_count: number;
}

const APP_URL = "https://archivum2704-dot.vercel.app";

function StatusIcon({ status }: { status: string }) {
  if (status === "active")   return <CheckCircle  size={14} color="#16A34A" />;
  if (status === "trialing") return <Clock        size={14} color="#2563EB" />;
  if (status === "past_due") return <AlertTriangle size={14} color="#D97706" />;
  return <XCircle size={14} color="#6B7280" />;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    active: "Activa", trialing: "Prueba gratuita", past_due: "Pago pendiente",
    canceled: "Cancelada", unpaid: "Impagada", incomplete: "Incompleta", paused: "Pausada",
  };
  return map[s] ?? s;
}

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
      const [{ data: orgData }, { count: memberCount }] = await Promise.all([
        supabase.from("organizations")
          .select("subscription_status,extra_users_quantity,extra_docs_quantity,document_count")
          .eq("id", org.id)
          .single(),
        supabase.from("organization_members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id),
      ]);
      if (orgData) {
        setPlan({ ...orgData, member_count: memberCount ?? 0 });
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
    Alert.alert("Cerrar sesión", "¿Estás seguro de que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión", style: "destructive",
        onPress: async () => { setSigningOut(true); await signOut(); },
      },
    ]);
  };

  const firstName = profile?.first_name ?? "";
  const lastName  = profile?.last_name  ?? "";
  const fullName  = [firstName, lastName].filter(Boolean).join(" ") || "Usuario";
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "U";

  const THEMES: { key: "light" | "dark" | "system"; label: string }[] = [
    { key: "light",  label: "Claro" },
    { key: "dark",   label: "Oscuro" },
    { key: "system", label: "Sistema" },
  ];
  const LANGS = [{ key: "es", label: "Español" }, { key: "en", label: "English" }];
  const [lang, setLang] = useState("es");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
          Ajustes
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
        <SectionLabel>Organización</SectionLabel>
        <Card>
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Nombre</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{org?.name ?? "—"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
            <View>
              <Text style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Código de acceso</Text>
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
                ? <><Check size={14} color={C.green} /><Text style={{ fontSize: 12, fontWeight: "600", color: C.green }}>Copiado</Text></>
                : <><Copy  size={14} color={C.blue}  /><Text style={{ fontSize: 12, fontWeight: "600", color: C.blue }}>Copiar</Text></>
              }
            </TouchableOpacity>
          </View>
        </Card>

        {/* Plan */}
        <SectionLabel>Plan y facturación</SectionLabel>
        <Card>
          {/* Status row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CreditCard size={16} color={C.muted} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>Archivum Pro</Text>
            </View>
            {plan ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: statusColor(plan.subscription_status) + "18", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }}>
                <StatusIcon status={plan.subscription_status} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: statusColor(plan.subscription_status) }}>
                  {statusLabel(plan.subscription_status)}
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
                  <Text style={{ fontSize: 13, color: C.muted }}>Usuarios</Text>
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
                  <Text style={{ fontSize: 13, color: C.muted }}>Documentos</Text>
                </View>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: "600" }}>
                  {plan.document_count} / {isPaidActive(plan.subscription_status) ? 500 + plan.extra_docs_quantity * 200 : 20}
                </Text>
              </View>
              <UsageBar value={plan.document_count} max={isPaidActive(plan.subscription_status) ? 500 + plan.extra_docs_quantity * 200 : 20} />
            </View>
          )}

          {/* Manage button */}
          <TouchableOpacity
            onPress={() => Linking.openURL(`${APP_URL}/configuracion/billing`)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}
          >
            <Text style={{ fontSize: 14, color: C.blue, fontWeight: "600" }}>Gestionar plan y facturación</Text>
            <ChevronRight size={16} color={C.blue} />
          </TouchableOpacity>
        </Card>

        {/* Preferences */}
        <SectionLabel>Preferencias</SectionLabel>
        <Card>
          {/* Language */}
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Globe size={15} color={C.muted} />
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>Idioma</Text>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 8, padding: 2 }}>
              {LANGS.map((l) => {
                const active = lang === l.key;
                return (
                  <TouchableOpacity key={l.key} onPress={() => setLang(l.key)} style={{
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
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>Tema</Text>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 8, padding: 2, gap: 2 }}>
              {THEMES.map((t) => {
                const active = theme === t.key;
                return (
                  <TouchableOpacity key={t.key} onPress={() => setTheme(t.key)} style={{
                    flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: "center",
                    backgroundColor: active ? C.surface : "transparent",
                    shadowColor: active ? "#000" : "transparent",
                    shadowOpacity: active ? 0.1 : 0, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: active ? 1 : 0,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: active ? "600" : "400", color: active ? C.blue : C.muted }}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Notifications */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Bell size={15} color={C.muted} />
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>Notificaciones</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#D1D5DB", true: C.blue }}
              thumbColor="#FFFFFF"
            />
          </View>
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
              : <><LogOut size={18} color={C.red} /><Text style={{ color: C.red, fontWeight: "600", fontSize: 15 }}>Cerrar sesión</Text></>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
