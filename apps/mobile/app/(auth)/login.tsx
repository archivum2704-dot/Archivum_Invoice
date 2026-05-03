'use client';
import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Building2, User, Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";

const C = {
  blue: "#2563EB", blueL: "#EFF6FF", blueMed: "#DBEAFE",
  red: "#DC2626", redL: "#FEF2F2",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280",
  border: "#E5E7EB", input: "#E5E7EB",
};

type Tab = "empresa" | "usuario";

export default function LoginScreen() {
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
    let err: string | null;
    if (tab === "empresa") {
      err = await signInEmpresa(email.trim(), password);
    } else {
      err = await signInUsuario(email.trim(), password, code);
    }
    if (err) {
      setError(err === "Invalid login credentials"
        ? "Email o contraseña incorrectos"
        : err);
      setLoading(false);
    } else {
      router.replace("/(app)/dashboard");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={{ alignItems: "center", paddingTop: 48, paddingBottom: 36 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 18,
              backgroundColor: C.blue, alignItems: "center", justifyContent: "center",
              marginBottom: 14,
            }}>
              <Text style={{ fontSize: 36, color: "#fff" }}>A</Text>
            </View>
            <Text style={{ fontSize: 26, fontWeight: "800", color: C.text, letterSpacing: -0.5 }}>
              archivum
            </Text>
            <Text style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              Archivo digital fiscal
            </Text>
          </View>

          {/* Tab switcher */}
          <View style={{
            flexDirection: "row", backgroundColor: "#F3F4F6",
            borderRadius: 12, padding: 3, marginBottom: 24,
          }}>
            {(["empresa", "usuario"] as Tab[]).map((t) => {
              const active = tab === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => { setTab(t); setError(null); }}
                  style={{
                    flex: 1, flexDirection: "row", alignItems: "center",
                    justifyContent: "center", gap: 6,
                    paddingVertical: 10, borderRadius: 9,
                    backgroundColor: active ? C.surface : "transparent",
                    shadowColor: active ? "#000" : "transparent",
                    shadowOpacity: active ? 0.08 : 0,
                    shadowRadius: active ? 4 : 0,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: active ? 2 : 0,
                  }}
                >
                  {t === "empresa"
                    ? <Building2 size={16} color={active ? C.blue : C.muted} />
                    : <User      size={16} color={active ? C.blue : C.muted} />
                  }
                  <Text style={{
                    fontSize: 14, fontWeight: active ? "600" : "400",
                    color: active ? C.blue : C.muted,
                  }}>
                    {t === "empresa" ? "Empresa" : "Usuario"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Fields */}
          <View style={{ gap: 16 }}>
            {tab === "usuario" && (
              <View>
                <Text style={styles.label}>Código de empresa</Text>
                <TextInput
                  style={[styles.input, { letterSpacing: 4, fontFamily: "monospace", textTransform: "uppercase" }]}
                  placeholder="AB-1234"
                  placeholderTextColor={C.muted}
                  value={code}
                  onChangeText={(v) => setCode(v.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={7}
                />
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  Código de 6 caracteres proporcionado por tu empresa
                </Text>
              </View>
            )}

            <View>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="david@empresa.com"
                placeholderTextColor={C.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text style={styles.label}>Contraseña</Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="••••••••"
                  placeholderTextColor={C.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPwd}
                />
                <TouchableOpacity
                  onPress={() => setShowPwd(!showPwd)}
                  style={{
                    position: "absolute", right: 14, top: 0, bottom: 0,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {showPwd
                    ? <EyeOff size={18} color={C.muted} />
                    : <Eye    size={18} color={C.muted} />
                  }
                </TouchableOpacity>
              </View>
              {tab === "empresa" && (
                <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 6 }}>
                  <Text style={{ fontSize: 13, color: C.blue, fontWeight: "500" }}>
                    ¿Olvidaste tu contraseña?
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {error && (
              <View style={{
                backgroundColor: C.redL, borderWidth: 1,
                borderColor: "rgba(220,38,38,.2)", borderRadius: 10,
                padding: 12,
              }}>
                <Text style={{ fontSize: 13, color: C.red }}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={{
                backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14,
                alignItems: "center", marginTop: 4,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Iniciar sesión</Text>
              }
            </TouchableOpacity>

            {tab === "usuario" && (
              <Text style={{ fontSize: 12, color: C.muted, textAlign: "center", lineHeight: 18 }}>
                Contacta con el administrador de tu empresa si no tienes credenciales de acceso.
              </Text>
            )}
          </View>

          {tab === "empresa" && (
            <TouchableOpacity
              onPress={() => router.push("/(auth)/register")}
              style={{ marginTop: 28, alignItems: "center" }}
            >
              <Text style={{ fontSize: 14, color: C.muted }}>
                ¿No tienes cuenta?{" "}
                <Text style={{ color: C.blue, fontWeight: "600" }}>Regístrate</Text>
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  label: {
    fontSize: 13, fontWeight: "500" as const, color: "#111827", marginBottom: 6,
  },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#111827", backgroundColor: "#FFFFFF",
  },
};
