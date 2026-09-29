import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

/**
 * Forma de pago como fila de chips. La misma en facturas emitidas, facturas
 * recibidas y la ficha de cliente, para que la lista sea siempre la de
 * `lib/payment-methods.ts`. Pulsar el chip activo lo deselecciona.
 */
export function PaymentMethodPicker({ value, onChange, label, disabled }: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const C = useColors();
  return (
    <View>
      {label ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text, marginBottom: 6 }}>{label}</Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 }}>
        {PAYMENT_METHODS.map(m => {
          const active = value === m;
          return (
            <TouchableOpacity key={m} disabled={disabled} onPress={() => onChange(active ? "" : m)}
              style={{
                paddingHorizontal: spacing.sm + 2, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1,
                borderColor: active ? C.blue : C.border,
                backgroundColor: active ? C.blueL : "transparent",
                opacity: disabled && !active ? 0.5 : 1,
              }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: active ? C.blue : C.text }}>{t(`paymentMethods.${m}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
