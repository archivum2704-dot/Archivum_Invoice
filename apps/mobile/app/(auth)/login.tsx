import { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Building2, User, Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { useShadows } from "@/lib/shadows";
import { Logo } from "@/components/Logo";
import { Input, Button } from "@/components/ui";

type Tab = "empresa" | "usuario";

export default function LoginScreen() {
  const C = useColors();
  const shadows = useShadows();
  const { signInEmpresa, signInUsuario } = useAuth();
  const [tab,         setTab]         = useState<Tab>("empresa");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [code,        setCode]        = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = tab === "empresa"
        ? await signInEmpresa(email.trim(), password)
        : await signInUsuario(email.trim(), password, code);
      if (result.error) {
        setError(result.error === "Invalid login credentials"
          ? "Email o contraseña incorrectos"
          : result.error);
        setLoading(false);
      } else if (result.mfaRequired) {
        router.replace("/(auth)/mfa");
      } else {
        router.replace("/(app)/dashboard");
      }
    } catch {
      setError("No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl + 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={{ alignItems: "center", paddingTop: 48, paddingBottom: spacing.xl + 12 }}>
            <View style={{ marginBottom: 14 }}>
              <Logo size={72} />
            </View>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 26, color: C.text, letterSpacing: -0.5 }}>
              archivum
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted, marginTop: 4 }}>
              Archivo digital fiscal
            </Text>
          </View>

          {/* Tab switcher */}
          <View style={{
            flexDirection: "row", backgroundColor: C.segmentBg,
            borderRadius: radius.md, padding: 3, marginBottom: spacing.xl,
          }}>
            {(["empresa", "usuario"] as Tab[]).map((t) => {
              const active = tab === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => { setTab(t); setError(null); }}
                  style={[
                    {
                      flex: 1, flexDirection: "row", alignItems: "center",
                      justifyContent: "center", gap: 6,
                      paddingVertical: 10, borderRadius: radius.md - 3,
                      backgroundColor: active ? C.surface : "transparent",
                    },
                    active ? shadows.sm : null,
                  ]}
                >
                  {t === "empresa"
                    ? <Building2 size={16} color={active ? C.blue : C.muted} strokeWidth={1.75} />
                    : <User      size={16} color={active ? C.blue : C.muted} strokeWidth={1.75} />
                  }
                  <Text style={{
                    fontFamily: active ? fonts.semibold : fonts.regular, fontSize: 14,
                    color: active ? C.blue : C.muted,
                  }}>
                    {t === "empresa" ? "Empresa" : "Usuario"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Fields */}
          <View style={{ gap: spacing.lg }}>
            {tab === "usuario" && (
              <Input
                label="Código de empresa"
                style={{ letterSpacing: 4, fontFamily: fonts.mono, textTransform: "uppercase" }}
                placeholder="AB-1234"
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                autoCapitalize="characters"
                maxLength={7}
                hint="Código de 6 caracteres proporcionado por tu empresa"
              />
            )}

            <Input
              label="Correo electrónico"
              placeholder="david@empresa.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View>
              <Input
                label="Contraseña"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                rightElement={
                  <TouchableOpacity onPress={() => setShowPwd(!showPwd)} hitSlop={8}>
                    {showPwd
                      ? <EyeOff size={18} color={C.muted} strokeWidth={1.75} />
                      : <Eye    size={18} color={C.muted} strokeWidth={1.75} />
                    }
                  </TouchableOpacity>
                }
              />
              {tab === "empresa" && (
                <TouchableOpacity
                  style={{ alignSelf: "flex-end", marginTop: 6 }}
                  onPress={async () => {
                    if (!email.trim()) {
                      Alert.alert("Email requerido", "Escribe tu correo electrónico para recuperar la contraseña.");
                      return;
                    }
                    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim());
                    if (resetErr) {
                      Alert.alert("Error", resetErr.message);
                    } else {
                      Alert.alert("Correo enviado", "Revisa tu bandeja de entrada para restablecer tu contraseña.");
                    }
                  }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.blue }}>
                    ¿Olvidaste tu contraseña?
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {error && (
              <View style={{
                backgroundColor: C.redL, borderWidth: 1,
                borderColor: "rgba(220,38,38,.2)", borderRadius: radius.md,
                padding: spacing.md,
              }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.red }}>{error}</Text>
              </View>
            )}

            <Button
              label="Iniciar sesión"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: 4 }}
            />

            {tab === "usuario" && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, textAlign: "center", lineHeight: 18 }}>
                Contacta con el administrador de tu empresa si no tienes credenciales de acceso.
              </Text>
            )}
          </View>

          {tab === "empresa" && (
            <TouchableOpacity
              onPress={() => router.push("/(auth)/register")}
              style={{ marginTop: 28, alignItems: "center" }}
            >
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted }}>
                ¿No tienes cuenta?{" "}
                <Text style={{ fontFamily: fonts.semibold, color: C.blue }}>Regístrate</Text>
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
