import { ReactNode } from "react";
import { View, ViewStyle } from "react-native";
import { useColors } from "@/lib/colors";
import { useShadows } from "@/lib/shadows";
import { radius } from "@/lib/radius";
import { spacing } from "@/lib/spacing";

const OUTER_PAD = 3;

/**
 * Double-bezel card: a hairline outer shell around an inner surface with a
 * tinted shadow, instead of a flat bordered box floating directly on the
 * page background.
 */
export function Card({ children, style, containerStyle, padded = true }: {
  children: ReactNode;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  padded?: boolean;
}) {
  const C = useColors();
  const shadows = useShadows();

  // The shadow lives on the outer shell, never on the same view as
  // overflow:hidden — on iOS those two together silently clip the shadow.
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: radius.xl,
          padding: OUTER_PAD,
        },
        shadows.md,
        containerStyle,
      ]}
    >
      <View
        style={[
          {
            backgroundColor: C.surface,
            borderRadius: radius.xl - OUTER_PAD,
            padding: padded ? spacing.lg : 0,
            overflow: "hidden",
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
