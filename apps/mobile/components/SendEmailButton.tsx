import { useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Mail, X, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { useAuth } from "@/context/auth-context";
import { APP_URL } from "@/lib/config";
import { readJson } from "@/lib/api";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { KeyboardModal } from "@/components/KeyboardModal";
import { Button, Input } from "@/components/ui";

/**
 * Send an invoice, quote or delivery note to its client with the PDF attached.
 *
 * The address is prefilled from the client record but stays editable, since the
 * one on file is often a billing inbox. Nothing leaves the app until the sender
 * confirms in the sheet — this is outward-facing mail.
 */
export function SendEmailButton({ kind, id, defaultTo }: {
  kind: "invoice" | "quote";
  id: string;
  defaultTo?: string | null;
}) {
  const { t } = useTranslation();
  const C = useColors();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const openSheet = () => {
    setTo(defaultTo ?? ""); setMessage(""); setSentTo(null); setOpen(true);
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch(`${APP_URL}/api/documents/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ kind, id, to: to.trim() || undefined, message: message.trim() || undefined }),
      });
      const json = await readJson(res);
      if (!res.ok) { Alert.alert(t("common.error"), json.detail ?? json.error ?? t("email.failed")); return; }
      setSentTo(json.to ?? to.trim());
    } catch (e) {
      Alert.alert(t("common.error"), String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        label={t("email.send")}
        onPress={openSheet}
        variant="secondary"
        icon={<Mail size={18} color={C.text} strokeWidth={1.75} />}
      />

      <KeyboardModal visible={open} animationType="slide" transparent onRequestClose={() => !sending && setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text }}>{t("email.title")}</Text>
              <TouchableOpacity onPress={() => !sending && setOpen(false)}><X size={22} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
            </View>

            {sentTo ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.lg + 2, gap: spacing.sm + 2 }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.greenL, alignItems: "center", justifyContent: "center" }}>
                  <Check size={22} color={C.green} strokeWidth={1.75} />
                </View>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: C.text }}>{t("email.sentTitle")}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>{sentTo}</Text>
                <Button
                  label={t("common.close")}
                  onPress={() => setOpen(false)}
                  fullWidth={false}
                  style={{ marginTop: spacing.xs + 2 }}
                />
              </View>
            ) : (
              <>
                <Input
                  label={`${t("email.to")} *`}
                  value={to} onChangeText={setTo} autoFocus
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  placeholder="cliente@empresa.com"
                  hint={!defaultTo ? t("email.noStoredEmail") : undefined}
                />
                <Input
                  label={t("email.message")}
                  value={message} onChangeText={setMessage} multiline
                  placeholder={t("email.messagePlaceholder")}
                  style={{ minHeight: 76, textAlignVertical: "top" }}
                />
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("email.attachmentNote")}</Text>
                <Button
                  label={t("email.send")}
                  onPress={send}
                  disabled={sending || !to.trim()}
                  loading={sending}
                  icon={<Mail size={18} color="#fff" strokeWidth={1.75} />}
                />
              </>
            )}
          </View>
        </View>
      </KeyboardModal>
    </>
  );
}
