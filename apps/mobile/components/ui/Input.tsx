import { ReactNode, useState } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { useColors } from "@/lib/colors";
import { radius } from "@/lib/radius";
import { fonts } from "@/lib/typography";

export function Input({ label, error, hint, rightElement, style, ...props }: TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  /** Adornment (e.g. a password visibility toggle) pinned inside the right edge of the field. */
  rightElement?: ReactNode;
}) {
  const C = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label && (
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text, marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          placeholderTextColor={C.muted}
          {...props}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[
            {
              borderWidth: 1.5,
              borderColor: error ? C.red : focused ? C.blue : C.border,
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              paddingRight: rightElement ? 44 : 14,
              fontFamily: fonts.regular,
              fontSize: 15,
              color: C.text,
              backgroundColor: C.inputBg,
            },
            style,
          ]}
        />
        {rightElement && (
          <View style={{ position: "absolute", right: 14 }}>{rightElement}</View>
        )}
      </View>
      {error ? (
        <Text style={{ fontSize: 12, color: C.red, marginTop: 4 }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </View>
  );
}
