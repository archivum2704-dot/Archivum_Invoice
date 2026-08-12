import { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useColors } from "@/lib/colors";
import { radius } from "@/lib/radius";
import { spacing } from "@/lib/spacing";
import { fonts } from "@/lib/typography";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const C = useColors();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: C.blue, fg: "#fff" },
    secondary: { bg: C.surface, fg: C.text, border: C.border },
    ghost: { bg: "transparent", fg: C.blue },
    danger: { bg: C.red, fg: "#fff" },
  };
  const { bg, fg, border } = palette[variant];
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => { scale.value = withTiming(0.98, { duration: 100 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 150 }); }}
      style={[
        animatedStyle,
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          backgroundColor: bg,
          borderRadius: radius.pill,
          borderWidth: border ? 1.5 : 0,
          borderColor: border,
          paddingVertical: size === "lg" ? 15 : 11,
          paddingHorizontal: spacing.xl,
          opacity: isDisabled ? 0.6 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text style={{ fontFamily: fonts.semibold, fontSize: size === "lg" ? 15 : 14, color: fg }}>
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}
