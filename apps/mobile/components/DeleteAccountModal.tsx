import { useState } from "react";
import { Alert, Linking, Text, TouchableOpacity, View } from "react-native";
import { UserX } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { KeyboardModal } from "@/components/KeyboardModal";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { APP_URL } from "@/lib/config";
import { readJson } from "@/lib/api";
import {
  ACCOUNT_DELETION_CONFIRM_WORD,
  ACCOUNT_DELETION_PATH,
  ORG_DATA_RETENTION_DAYS,
} from "@/lib/account-deletion";

/**
 * Eliminar la cuenta desde la app, como exige Google Play. Llama a la misma
 * ruta que la web (/api/account/delete), que decide qué se borra y qué no.
 */
export function DeleteAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const C = useColors();
  const { session, signOut } = useAuth();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = word.trim().toUpperCase() === ACCOUNT_DELETION_CONFIRM_WORD;
  const vars = { word: ACCOUNT_DELETION_CONFIRM_WORD, days: ORG_DATA_RETENTION_DAYS };

  const close = () => {
    if (busy) return;
    setWord("");
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${APP_URL}/api/account/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ confirm: word }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        const key = ["owner_with_members", "unauthorized", "stripe_cancel_failed", "confirmation_required"].includes(data?.error)
          ? data.error
          : "generic";
        setError(t(`ajustes.deleteAccount.errors.${key}`, {
          ...vars,
          orgs: Array.isArray(data?.organizations) ? data.organizations.join(", ") : "",
        }));
        return;
      }
      setBusy(false);
      setWord("");
      onClose();
      Alert.alert(t("ajustes.deleteAccount.doneTitle"), t("ajustes.deleteAccount.doneBody"), [
        { text: t("common.gotIt"), onPress: () => { signOut(); } },
      ]);
      return;
    } catch {
      setError(t("ajustes.deleteAccount.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={close} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xl + 8 }}>
        <View style={{ alignItems: "center", marginBottom: spacing.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.redL ?? C.blueL, alignItems: "center", justifyContent: "center" }}>
            <UserX size={24} color={C.red} strokeWidth={1.75} />
          </View>
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 18, color: C.text, textAlign: "center", marginBottom: spacing.sm }}>
          {t("ajustes.deleteAccount.title")}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: spacing.md }}>
          {t("ajustes.deleteAccount.body", vars)}
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL(`${APP_URL}${ACCOUNT_DELETION_PATH}`)} style={{ marginBottom: spacing.md }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.blue }}>{t("ajustes.deleteAccount.moreInfo")}</Text>
        </TouchableOpacity>
        <Input
          label={t("ajustes.deleteAccount.confirmLabel", vars)}
          value={word}
          onChangeText={setWord}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
        />
        {error && (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.red, marginTop: spacing.sm, lineHeight: 19 }}>{error}</Text>
        )}
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Button
            label={t("ajustes.deleteAccount.confirm")}
            onPress={handleDelete}
            variant="danger"
            loading={busy}
            disabled={!ready || busy}
          />
          <TouchableOpacity onPress={close} style={{ alignItems: "center", paddingVertical: spacing.sm + 2 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted }}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardModal>
  );
}
