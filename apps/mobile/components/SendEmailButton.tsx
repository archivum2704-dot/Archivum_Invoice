import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Mail, X, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { useAuth } from "@/context/auth-context";
import { APP_URL } from "@/lib/config";
import { readJson } from "@/lib/api";
import { KeyboardModal } from "@/components/KeyboardModal";

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

  const inputStyle = {
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 10, color: C.text, fontSize: 15,
  };

  return (
    <>
      <TouchableOpacity
        onPress={openSheet}
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
          borderRadius: 12, paddingVertical: 14,
        }}
      >
        <Mail size={18} color={C.text} />
        <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{t("email.send")}</Text>
      </TouchableOpacity>

      <KeyboardModal visible={open} animationType="slide" transparent onRequestClose={() => !sending && setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{t("email.title")}</Text>
              <TouchableOpacity onPress={() => !sending && setOpen(false)}><X size={22} color={C.muted} /></TouchableOpacity>
            </View>

            {sentTo ? (
              <View style={{ alignItems: "center", paddingVertical: 18, gap: 10 }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.greenL, alignItems: "center", justifyContent: "center" }}>
                  <Check size={22} color={C.green} />
                </View>
                <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{t("email.sentTitle")}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{sentTo}</Text>
                <TouchableOpacity onPress={() => setOpen(false)} style={{ marginTop: 6, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 26 }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("common.close")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View>
                  <Text style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>{t("email.to")} *</Text>
                  <TextInput
                    value={to} onChangeText={setTo} autoFocus
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                    placeholder="cliente@empresa.com" placeholderTextColor={C.muted}
                    style={inputStyle}
                  />
                  {!defaultTo && <Text style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{t("email.noStoredEmail")}</Text>}
                </View>
                <View>
                  <Text style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>{t("email.message")}</Text>
                  <TextInput
                    value={message} onChangeText={setMessage} multiline
                    placeholder={t("email.messagePlaceholder")} placeholderTextColor={C.muted}
                    style={{ ...inputStyle, minHeight: 76, textAlignVertical: "top" }}
                  />
                </View>
                <Text style={{ fontSize: 11, color: C.muted }}>{t("email.attachmentNote")}</Text>
                <TouchableOpacity
                  onPress={send} disabled={sending || !to.trim()}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                    backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14,
                    opacity: sending || !to.trim() ? 0.5 : 1,
                  }}
                >
                  {sending ? <ActivityIndicator color="#fff" /> : <Mail size={18} color="#fff" />}
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("email.send")}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardModal>
    </>
  );
}
