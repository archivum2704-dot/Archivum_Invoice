import { useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { Logo } from "@/components/Logo";
import { Input, Button } from "@/components/ui";

/** Second step of login for accounts with TOTP enabled — mirrors the web's
 * /auth/mfa challenge screen (see lib/supabase/proxy.ts on the web for the
 * equivalent aal1→aal2 gate). Reached only from login.tsx, right after a
 * password sign-in that came back with mfaRequired: true. */
export default function MfaScreen() {
  const C = useColors();
  const { verifyMfaCode, cancelMfa } = useAuth();
  const [code,      setCode]      = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    const err = await verifyMfaCode(code);
    setLoading(false);
    if (err) {
      setError(err);
      setCode("");
      return;
    }
    router.replace("/(app)/dashboard");
  };

  const handleCancel = async () => {
    setSigningOut(true);
    await cancelMfa();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl }}>
          <View style={{ alignItems: "center", marginBottom: spacing.xl + 8, gap: 14 }}>
            <Logo size={56} />
            <View style={{
              width: 48, height: 48, borderRadius: radius.lg,
              backgroundColor: C.blueL, alignItems: "center", justifyContent: "center",
            }}>
              <ShieldCheck size={24} color={C.blue} strokeWidth={1.75} />
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 20, color: C.text, letterSpacing: -0.3 }}>
                Verificación en dos pasos
              </Text>
              <Text style={{
                fontFamily: fonts.regular, fontSize: 13, color: C.muted,
                marginTop: 4, textAlign: "center",
              }}>
                Introduce el código de 6 dígitos de tu app de autenticación
              </Text>
            </View>
          </View>

          <View style={{ gap: spacing.lg }}>
            <Input
              placeholder="000000"
              value={code}
              onChangeText={(v) => { setCode(v.replace(/\D/g, "").slice(0, 6)); setError(null); }}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              style={{
                textAlign: "center", fontSize: 26, letterSpacing: 10,
                fontFamily: fonts.mono, paddingVertical: 16,
              }}
            />

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
              label="Verificar"
              onPress={handleVerify}
              loading={loading}
              disabled={code.length !== 6}
            />

            <TouchableOpacity
              onPress={handleCancel}
              disabled={signingOut}
              style={{ alignItems: "center", marginTop: 4, opacity: signingOut ? 0.6 : 1 }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.muted }}>
                Cerrar sesión en su lugar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
