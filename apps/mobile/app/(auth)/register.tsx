import { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { useColors } from "@/lib/colors";
import { useTranslation } from "react-i18next";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { Input, Button } from "@/components/ui";

export default function RegisterScreen() {
  const C = useColors();
  const { t } = useTranslation();
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
    if (password !== confirm) { setError(t("register.errorMismatch")); return; }
    if (password.length < 8)  { setError(t("register.errorMinLength")); return; }
    setLoading(true);
    setError(null);
    const err = await signUp(email.trim(), password, firstName.trim(), lastName.trim());
    setLoading(false);
    if (err) {
      setError(err === "User already registered" ? t("register.errorAlreadyRegistered") : err);
    } else {
      router.replace("/(auth)/login");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.lg, marginBottom: spacing.sm }}>
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft size={24} color={C.blue} strokeWidth={1.75} />
            </TouchableOpacity>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text, letterSpacing: -0.5 }}>
              {t("register.title")}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted, marginBottom: spacing.xl + 4 }}>
            {t("register.subtitle")}
          </Text>

          <View style={{ gap: spacing.lg }}>
            {/* Name row */}
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label={t("register.firstName")}
                  placeholder="David"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label={t("register.lastName")}
                  placeholder="Martínez"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            <Input
              label={t("register.email")}
              placeholder="david@empresa.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label={t("register.password")}
              placeholder={t("register.passwordHint")}
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

            <Input
              label={t("register.confirmPassword")}
              placeholder="••••••••"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              rightElement={
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={8}>
                  {showConfirm
                    ? <EyeOff size={18} color={C.muted} strokeWidth={1.75} />
                    : <Eye    size={18} color={C.muted} strokeWidth={1.75} />
                  }
                </TouchableOpacity>
              }
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
              label={t("register.submit")}
              onPress={handleRegister}
              loading={loading}
              style={{ marginTop: 4 }}
            />
          </View>

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.xl, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted }}>
              {t("register.hasAccount")}{" "}
              <Text style={{ fontFamily: fonts.semibold, color: C.blue }}>{t("register.signIn")}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
