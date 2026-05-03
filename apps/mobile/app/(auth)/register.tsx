import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";

const C = {
  blue: "#2563EB", red: "#DC2626", redL: "#FEF2F2",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
};

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [firstName,    setFirstName]    = useState("");
  const [lastName,     setLastName]     = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [showPwd,      setShowPwd]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const handleRegister = async () => {
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    if (password.length < 8)  { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    setLoading(true);
    setError(null);
    const err = await signUp(email.trim(), password, firstName.trim(), lastName.trim());
    setLoading(false);
    if (err) {
      setError(err === "User already registered" ? "Este email ya está registrado" : err);
    } else {
      router.replace("/(auth)/login");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, marginBottom: 8 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft size={24} color={C.blue} />
            </TouchableOpacity>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, letterSpacing: -0.5 }}>
              Crear cuenta
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>
            Completa tus datos para registrarte en Archivum.
          </Text>

          <View style={{ gap: 16 }}>
            {/* Name row */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput style={styles.input} placeholder="David" placeholderTextColor={C.muted} value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Apellidos</Text>
                <TextInput style={styles.input} placeholder="Martínez" placeholderTextColor={C.muted} value={lastName} onChangeText={setLastName} />
              </View>
            </View>

            <View>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input} placeholder="david@empresa.com"
                placeholderTextColor={C.muted} value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none"
              />
            </View>

            <View>
              <Text style={styles.label}>Contraseña</Text>
              <View>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="Mín. 8 caracteres" placeholderTextColor={C.muted}
                  value={password} onChangeText={setPassword}
                  secureTextEntry={!showPwd}
                />
                <TouchableOpacity
                  onPress={() => setShowPwd(!showPwd)}
                  style={{ position: "absolute", right: 14, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
                >
                  {showPwd ? <EyeOff size={18} color={C.muted} /> : <Eye size={18} color={C.muted} />}
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text style={styles.label}>Confirmar contraseña</Text>
              <View>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="••••••••" placeholderTextColor={C.muted}
                  value={confirm} onChangeText={setConfirm}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm(!showConfirm)}
                  style={{ position: "absolute", right: 14, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
                >
                  {showConfirm ? <EyeOff size={18} color={C.muted} /> : <Eye size={18} color={C.muted} />}
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={{ backgroundColor: C.redL, borderWidth: 1, borderColor: "rgba(220,38,38,.2)", borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 13, color: C.red }}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              style={{ backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Crear cuenta</Text>
              }
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: C.muted }}>
              ¿Ya tienes cuenta?{" "}
              <Text style={{ color: C.blue, fontWeight: "600" }}>Inicia sesión</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  label: { fontSize: 13, fontWeight: "500" as const, color: "#111827", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827", backgroundColor: "#FFFFFF",
  },
};
