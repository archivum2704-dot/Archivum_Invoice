import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
// Local supabase client (uses EXPO_PUBLIC_ env vars — avoids shared lib issues)
import "@/lib/supabase";
// i18n must be initialised before any component calls useTranslation()
import { initI18n } from "@/lib/i18n";
initI18n();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    // Agrega tus fuentes aquí si usas custom fonts
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Drives the keyboard-aware views. The translucent flags let it track
          the keyboard inside RN modals too, which is where our forms live. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <Stack screenOptions={{ headerShown: false }} />
              <StatusBar style="auto" />
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
