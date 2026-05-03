import { Tabs, Redirect } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { View, ActivityIndicator } from "react-native";
import {
  Home, BookOpen, Search, Building2, Settings,
} from "lucide-react-native";

const BLUE    = "#2563EB";
const MUTED   = "#9CA3AF";
const SURFACE = "#FFFFFF";
const BORDER  = "#E5E7EB";

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB" }}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BLUE,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          backgroundColor: SURFACE,
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="biblioteca"
        options={{
          title: "Biblioteca",
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          title: "Buscar",
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="empresas"
        options={{
          title: "Empresas",
          tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />

      {/* Detail / action screens — hidden from tab bar */}
      <Tabs.Screen name="documento/[id]" options={{ href: null }} />
      <Tabs.Screen name="editar/[id]"    options={{ href: null }} />
      <Tabs.Screen name="subir"          options={{ href: null }} />
    </Tabs>
  );
}
