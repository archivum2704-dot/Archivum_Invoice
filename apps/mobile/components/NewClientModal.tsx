import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { X, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { KeyboardModal } from "@/components/KeyboardModal";

export interface CreatedClient { id: string; name: string; cif: string | null }

const EMPTY = { name: "", cif: "", email: "", phone: "", address: "", postal_code: "", city: "", province: "" };

/**
 * Turn a Postgres error into something a user can act on.
 *
 * The plan-limit trigger already raises its own Spanish message, so that one is
 * shown verbatim. A row-level-security refusal is not: it arrives as "new row
 * violates row-level security policy", which tells the reader nothing.
 */
/**
 * A v4-shaped random id for a new client row.
 *
 * Deliberately not expo-crypto: that is a native module, so adding it would
 * make this fix need a new binary instead of riding an over-the-air update.
 * The value is a primary key, never a secret — access is decided by RLS, not by
 * the id being unguessable — and the column's unique constraint would surface a
 * collision as an error rather than letting it corrupt anything.
 */
function randomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function explain(err: { code?: string; message?: string }, fallback: string): string {
  if (err.code === "42501") {
    return "Tu usuario no tiene permiso para crear clientes. Pídeselo a un administrador de la organización.";
  }
  return err.message ?? fallback;
}

/**
 * Create a client without leaving the invoice or quote being written.
 *
 * The old inline version was two fields wedged into the client picker — name
 * and CIF — so a client created while invoicing had no address, which a Spanish
 * invoice has to print, and no email, so the document could not be sent to
 * them. This asks for all of it, in a sheet with room to type.
 */
export function NewClientModal({ visible, orgId, onCreated, onClose }: {
  visible: boolean;
  orgId: string | null;
  onCreated: (client: CreatedClient) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const C = useColors();
  const [nc, setNc] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof EMPTY) => (v: string) => setNc(prev => ({ ...prev, [k]: v }));

  const close = () => { if (!saving) { setNc(EMPTY); onClose(); } };

  const create = async () => {
    if (!nc.name.trim() || !orgId) return;
    setSaving(true);
    // The id is generated here rather than read back from the insert. Reading
    // it back means INSERT ... RETURNING, and RETURNING is subject to the
    // SELECT policy on companies — which a plain member does not satisfy for a
    // client they have just created, so the row was written and the call still
    // failed with a permissions error.
    const id = randomId();
    const { error } = await supabase.from("companies").insert({
      id,
      organization_id: orgId,
      name: nc.name.trim(),
      cif: nc.cif.trim() || null,
      email: nc.email.trim() || null,
      phone: nc.phone.trim() || null,
      address: nc.address.trim() || null,
      postal_code: nc.postal_code.trim() || null,
      city: nc.city.trim() || null,
      province: nc.province.trim() || null,
      is_active: true,
    });
    setSaving(false);
    if (error) { Alert.alert(t("common.error"), explain(error, t("invoicing.createClientError"))); return; }
    onCreated({ id, name: nc.name.trim(), cif: nc.cif.trim() || null });
    setNc(EMPTY);
    onClose();
  };

  const field = (label: string, key: keyof typeof EMPTY, extra?: object) => (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={nc[key]}
        onChangeText={set(key)}
        placeholderTextColor={C.muted}
        style={{
          backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 8,
          paddingHorizontal: 10, paddingVertical: 9, color: C.text, fontSize: 15,
        }}
        {...extra}
      />
    </View>
  );

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "92%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{t("invoicing.newClient")}</Text>
            <TouchableOpacity onPress={close}><X size={22} color={C.muted} /></TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
          >
            {field(`${t("invoicing.clientName")} *`, "name", { autoFocus: true })}
            {field("CIF", "cif", { autoCapitalize: "characters", placeholder: "B12345678" })}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {field(t("invoicing.clientEmail"), "email", { keyboardType: "email-address", autoCapitalize: "none", placeholder: "cliente@empresa.com" })}
              {field(t("invoicing.clientPhone"), "phone", { keyboardType: "phone-pad" })}
            </View>
            <Text style={{ fontSize: 11, color: C.muted, marginTop: -6 }}>{t("invoicing.clientEmailHint")}</Text>
            {field(t("invoicing.clientAddress"), "address")}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {field(t("invoicing.clientPostalCode"), "postal_code")}
              {field(t("invoicing.clientCity"), "city")}
            </View>
            {field(t("invoicing.clientProvince"), "province")}

            <TouchableOpacity
              onPress={create}
              disabled={saving || !nc.name.trim()}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, marginTop: 4,
                opacity: saving || !nc.name.trim() ? 0.5 : 1,
              }}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Plus size={18} color="#fff" />}
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("invoicing.createClient")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </KeyboardModal>
  );
}
