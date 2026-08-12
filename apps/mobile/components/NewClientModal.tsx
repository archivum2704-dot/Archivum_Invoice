import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Plus, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { KeyboardModal } from "@/components/KeyboardModal";
import { Button, Input } from "@/components/ui";
import { TAX_ID_TYPES, isForeignClient } from "@/lib/tax-id-types";

export interface CreatedClient { id: string; name: string; cif: string | null }

const EMPTY = {
  name: "", cif: "", email: "", phone: "", address: "", postal_code: "", city: "", province: "",
  country_code: "ES", tax_id_type: "",
};

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

/**
 * Turn a Postgres error into something a user can act on.
 *
 * The plan-limit trigger already raises its own Spanish message, so that one is
 * shown verbatim. A row-level-security refusal is not: it arrives as "new row
 * violates row-level security policy", which tells the reader nothing.
 */
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
  const foreign = isForeignClient(nc.country_code);

  const set = (k: keyof typeof EMPTY) => (v: string) => setNc(prev => ({ ...prev, [k]: v }));

  const close = () => { if (!saving) { setNc(EMPTY); onClose(); } };

  const create = async () => {
    if (!nc.name.trim() || !orgId) return;
    setSaving(true);
    // The id is generated here rather than read back from the insert.
    //
    // Reading it back means INSERT ... RETURNING, and RETURNING is checked
    // against the SELECT policy, companies_select = can_access_company(id).
    // That function resolves the organization by looking the company up in the
    // table — and at check time the row is not in the table yet, so it finds
    // nothing and denies. Every user hit this, owners included: the client was
    // written and the call still failed with a permissions error.
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
      country_code: nc.country_code.trim().toUpperCase() || "ES",
      // Only a foreign client carries a document type; a Spanish one is a NIF.
      tax_id_type: isForeignClient(nc.country_code) ? (nc.tax_id_type || null) : null,
      is_active: true,
    });
    setSaving(false);
    if (error) { Alert.alert(t("common.error"), explain(error, t("invoicing.createClientError"))); return; }
    onCreated({ id, name: nc.name.trim(), cif: nc.cif.trim() || null });
    setNc(EMPTY);
    onClose();
  };

  const field = (label: string, key: keyof typeof EMPTY, extra?: object) => (
    <Input label={label} value={nc[key]} onChangeText={set(key)} {...extra} />
  );

  const disabled = saving || !nc.name.trim() || (foreign && !!nc.cif.trim() && !nc.tax_id_type);

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: "92%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text }}>{t("invoicing.newClient")}</Text>
            <TouchableOpacity onPress={close}><X size={22} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}
          >
            {field(`${t("invoicing.clientName")} *`, "name", { autoFocus: true })}
            <View style={{ flexDirection: "row", gap: spacing.sm + 2 }}>
              <View style={{ flex: 2 }}>
                {field(foreign ? t("invoicing.clientTaxId") : "CIF", "cif",
                  { autoCapitalize: "characters", placeholder: foreign ? "DE123456789" : "B12345678" })}
              </View>
              <View style={{ flex: 1 }}>
                {field(t("invoicing.clientCountry"), "country_code", { autoCapitalize: "characters", maxLength: 2, placeholder: "ES" })}
              </View>
            </View>
            {foreign && (
              <View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text, marginBottom: 6 }}>
                  {t("invoicing.clientTaxIdType")} *
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 }}>
                  {TAX_ID_TYPES.map(o => (
                    <TouchableOpacity key={o.code} onPress={() => setNc(p => ({ ...p, tax_id_type: o.code }))}
                      style={{
                        paddingHorizontal: spacing.sm + 2, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1,
                        borderColor: nc.tax_id_type === o.code ? C.blue : C.border,
                        backgroundColor: nc.tax_id_type === o.code ? C.blueL : "transparent",
                      }}>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: nc.tax_id_type === o.code ? C.blue : C.text }}>{o.es}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: 6 }}>{t("invoicing.clientTaxIdTypeHint")}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: spacing.sm + 2 }}>
              <View style={{ flex: 1 }}>{field(t("invoicing.clientEmail"), "email", { keyboardType: "email-address", autoCapitalize: "none", placeholder: "cliente@empresa.com" })}</View>
              <View style={{ flex: 1 }}>{field(t("invoicing.clientPhone"), "phone", { keyboardType: "phone-pad" })}</View>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: -spacing.sm }}>{t("invoicing.clientEmailHint")}</Text>
            {field(t("invoicing.clientAddress"), "address")}
            <View style={{ flexDirection: "row", gap: spacing.sm + 2 }}>
              <View style={{ flex: 1 }}>{field(t("invoicing.clientPostalCode"), "postal_code")}</View>
              <View style={{ flex: 1 }}>{field(t("invoicing.clientCity"), "city")}</View>
            </View>
            {field(t("invoicing.clientProvince"), "province")}

            <Button
              label={t("invoicing.createClient")}
              onPress={create}
              disabled={disabled}
              loading={saving}
              icon={<Plus size={18} color="#fff" strokeWidth={1.75} />}
              style={{ marginTop: spacing.xs }}
            />
          </ScrollView>
        </View>
      </View>
    </KeyboardModal>
  );
}
