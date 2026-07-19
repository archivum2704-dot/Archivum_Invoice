import { Tabs, Redirect, usePathname } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { View, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/lib/colors";
import {
  Home, BookOpen, Search, Building2, Users, Settings,
} from "lucide-react-native";

export default function AppLayout() {
  const { t } = useTranslation();
  const C = useColors();
  const { session, loading, profile, orgId } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isOnboardingRoute = pathname?.includes("onboarding");

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
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="biblioteca"
        options={{
          title: t("tabs.library"),
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          title: t("tabs.search"),
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="empresas"
        options={{
          title: t("tabs.companies"),
          tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="equipo"
        options={{
          title: t("tabs.team"),
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />

      {/* Detail / action screens — hidden from tab bar */}
      <Tabs.Screen name="documento/[id]" options={{ href: null }} />
      <Tabs.Screen name="editar/[id]"    options={{ href: null }} />
      <Tabs.Screen name="subir"          options={{ href: null }} />
      <Tabs.Screen name="onboarding"     options={{ href: null }} />
      <Tabs.Screen name="inventario"     options={{ href: null }} />
      <Tabs.Screen name="facturacion"    options={{ href: null }} />
      <Tabs.Screen name="factura/[id]"   options={{ href: null }} />
    </Tabs>
  );
}
