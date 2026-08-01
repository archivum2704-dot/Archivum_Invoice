import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Lock, ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { useAccessContext } from "@/lib/useAccess";
import { denyReason, type SectionId, type DenyReason } from "@/lib/permissions";

/**
 * Shown in place of a section the member may not open.
 *
 * Deliberately a message rather than a silent redirect: a member who gets here
 * should understand that the section exists and that access is a permissions
 * matter, not that the app is broken.
 */
export function AccessDenied({ reason = "role" }: { reason?: DenyReason }) {
  const C = useColors();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <View
          style={{
            width: 56, height: 56, borderRadius: 18, backgroundColor: C.segmentBg,
            alignItems: "center", justifyContent: "center", marginBottom: 20,
          }}
        >
          <Lock size={24} color={C.muted} />
        </View>

        <Text style={{ fontSize: 17, fontWeight: "600", color: C.text, textAlign: "center" }}>
          {t("access.deniedTitle")}
        </Text>
        <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 21, marginTop: 8 }}>
          {reason === "noCompanies" ? t("access.deniedNoCompanies") : t("access.deniedRole")}
        </Text>

        <TouchableOpacity
          onPress={() => router.replace("/(app)/dashboard")}
          style={{
            flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28,
            backgroundColor: C.blue, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
          }}
        >
          <ArrowLeft size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
            {t("access.backToDashboard")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/**
 * Renders a screen only for members allowed to open it, and the reason why not
 * for everyone else. The matching tab renders locked from the same table, so
 * the two always agree.
 */
export function RequirePermission({ section, children }: { section: SectionId; children: React.ReactNode }) {
  const C = useColors();
  const { ctx, loading } = useAccessContext();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  const reason = denyReason(section, ctx);
  if (reason) return <AccessDenied reason={reason} />;

  return <>{children}</>;
}
