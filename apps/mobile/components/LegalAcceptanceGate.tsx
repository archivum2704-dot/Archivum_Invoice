import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { LEGAL_VERSION } from "@/lib/legal-version";
import { KeyboardModal } from "@/components/KeyboardModal";
import { Button } from "@/components/ui";
import { LegalConsentCheckbox } from "@/components/LegalConsent";

/**
 * Same as the web's LegalAcceptanceGate: accounts that never accepted the
 * conditions in force (created before 3 Nov 2026, or LEGAL_VERSION changed)
 * accept them once. The record is the user's metadata, as on sign-up.
 */
export function LegalAcceptanceGate() {
  const C = useColors();
  const [needed, setNeeded] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && data.user.user_metadata?.legal_version !== LEGAL_VERSION) setNeeded(true);
    });
  }, []);

  const accept = async () => {
    setSaving(true); setError(null);
    const { error: err } = await supabase.auth.updateUser({
      data: { legal_version: LEGAL_VERSION, legal_accepted_at: new Date().toISOString() },
    });
    setSaving(false);
    if (err) { setError("No se pudo guardar la aceptación. Inténtalo de nuevo."); return; }
    setNeeded(false);
  };

  return (
    <KeyboardModal visible={needed} animationType="fade" transparent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", padding: spacing.lg }}>
        <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text }}>Condiciones de Archivum</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted, lineHeight: 19 }}>
            Hemos publicado el Aviso legal, las Condiciones de uso y de contratación y el Contrato de encargo
            del tratamiento de datos. Para seguir usando Archivum tienes que aceptarlos.
          </Text>
          <LegalConsentCheckbox checked={checked} onChange={setChecked} />
          {!!error && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.red }}>{error}</Text>}
          <Button label="Aceptar y continuar" onPress={accept} disabled={!checked || saving} loading={saving} />
        </View>
      </View>
    </KeyboardModal>
  );
}
