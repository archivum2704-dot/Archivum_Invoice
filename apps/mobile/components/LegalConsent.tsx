import { View, Text, TouchableOpacity, Linking } from "react-native";
import { Check } from "lucide-react-native";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { radius } from "@/lib/radius";
import { APP_URL } from "@/lib/config";

/**
 * Casillas de aceptación (aviso legal, anexo III), igual que en la web
 * (components/legal-consent.tsx). Ninguna premarcada; la comercial, aparte.
 */
function Box({ checked, onPress, children }: { checked: boolean; onPress: () => void; children: React.ReactNode }) {
  const C = useColors();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={{
        width: 20, height: 20, borderRadius: radius.sm - 2, borderWidth: 1.5, marginTop: 1,
        borderColor: checked ? C.blue : C.border, backgroundColor: checked ? C.blue : "transparent",
        alignItems: "center", justifyContent: "center",
      }}>
        {checked && <Check size={14} color="#fff" strokeWidth={2.5} />}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </TouchableOpacity>
  );
}

export function LegalConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const C = useColors();
  const link = (path: string, label: string) => (
    <Text style={{ color: C.blue, textDecorationLine: "underline" }} onPress={() => Linking.openURL(`${APP_URL}${path}`)}>{label}</Text>
  );
  return (
    <Box checked={checked} onPress={() => onChange(!checked)}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, lineHeight: 18 }}>
        He leído y acepto el {link("/terminos", "Aviso legal y las Condiciones de uso y de contratación")} y
        el {link("/encargo-tratamiento", "Contrato de encargo del tratamiento")}, y he leído
        la {link("/privacidad", "Política de privacidad")}.
      </Text>
    </Box>
  );
}

export function MarketingConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const C = useColors();
  return (
    <Box checked={checked} onPress={() => onChange(!checked)}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, lineHeight: 18 }}>
        Deseo recibir comunicaciones comerciales sobre productos, servicios y novedades de Archivum (opcional).
      </Text>
    </Box>
  );
}
