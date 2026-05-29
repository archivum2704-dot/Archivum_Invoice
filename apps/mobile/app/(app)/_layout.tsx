import { Tabs, Redirect, usePathname } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/lib/colors";
import {
  Home, BookOpen, Search, Building2, Users, Settings,
} from "lucide-react-native";

export default function AppLayout() {
  const { t } = useTranslation();
  const C = useColors();
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding,   setNeedsOnboarding]   = useState(false);
  const isOnboardingRoute = pathname?.includes("onboarding");

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem("@archivum/onboarding_completed");
        setNeedsOnboarding(v !== "true");
      } catch {
        setNeedsOnboarding(false);
      }
      setOnboardingChecked(true);
    })();
  }, [pathname]);

  if (loading || !onboardingChecked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (needsOnboarding && !isOnboardingRoute) return <Redirect href="/(app)/onboarding" />;

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
    </Tabs>
  );
}
