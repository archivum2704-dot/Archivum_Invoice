import { Tabs, Redirect, usePathname } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { View, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/lib/colors";
import { useAccessContext } from "@/lib/useAccess";
import { canAccess, type SectionId } from "@/lib/permissions";
import {
  Home, BookOpen, Search, Building2, Users, Settings, Lock,
} from "lucide-react-native";

export default function AppLayout() {
  const { t } = useTranslation();
  const C = useColors();
  const { session, loading, profile, orgId } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isOnboardingRoute = pathname?.includes("onboarding");
  const { ctx: accessCtx } = useAccessContext();

  /**
   * Tabs a member may not open stay in the bar wearing a padlock. Hiding them
   * would conceal what the product does; the screen itself explains why it is
   * closed, resolved from the same table in @/lib/permissions.
   */
  const tabIcon = (
    section: SectionId,
    Icon: typeof Home,
  ) => ({ color, size }: { color: string; size: number }) => {
    const locked = !canAccess(section, accessCtx);
    return (
      <View>
        <Icon size={size} color={locked ? C.muted : color} opacity={locked ? 0.45 : 1} />
        {locked && (
          <View style={{ position: "absolute", top: -3, right: -5 }}>
            <Lock size={11} color={C.muted} />
          </View>
        )}
      </View>
    );
  };

  // Wait for the profile too: right after a fresh sign-in the session exists
  // but the profile (and with it orgId) is still loading. Deciding on orgId
  // before that would wrongly send existing users to onboarding.
  if (loading || (session && !profile)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  // Only users without an organization go through onboarding (its last step
  // creates one). Existing users with an org land on the dashboard directly;
  // they can replay the tutorial from Ajustes.
  if (!orgId && !isOnboardingRoute) return <Redirect href="/(app)/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tabs.home"),
          tabBarIcon: tabIcon("dashboard", Home),
        }}
      />
      <Tabs.Screen
        name="biblioteca"
        options={{
          title: t("tabs.library"),
          tabBarIcon: tabIcon("biblioteca", BookOpen),
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          title: t("tabs.search"),
          tabBarIcon: tabIcon("buscar", Search),
        }}
      />
      <Tabs.Screen
        name="empresas"
        options={{
          title: t("tabs.companies"),
          tabBarIcon: tabIcon("empresas", Building2),
        }}
      />
      <Tabs.Screen
        name="equipo"
        options={{
          title: t("tabs.team"),
          tabBarIcon: tabIcon("equipo", Users),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: tabIcon("ajustes", Settings),
        }}
      />

      {/* Detail / action screens — hidden from tab bar */}
      <Tabs.Screen name="documento/[id]" options={{ href: null }} />
      <Tabs.Screen name="editar/[id]"    options={{ href: null }} />
      <Tabs.Screen name="subir"          options={{ href: null }} />
      <Tabs.Screen name="onboarding"     options={{ href: null }} />
      <Tabs.Screen name="inventario"     options={{ href: null }} />
      <Tabs.Screen name="facturacion"    options={{ href: null }} />
      <Tabs.Screen name="presupuestos"   options={{ href: null }} />
      <Tabs.Screen name="albaranes"      options={{ href: null }} />
      <Tabs.Screen name="presupuesto/[id]" options={{ href: null }} />
      <Tabs.Screen name="factura/[id]"   options={{ href: null }} />
    </Tabs>
  );
}
