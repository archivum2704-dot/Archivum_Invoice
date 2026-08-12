import { useEffect } from "react";
import { DimensionValue, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useColors } from "@/lib/colors";
import { radius } from "@/lib/radius";

export function Skeleton({ width = "100%", height = 16, style }: {
  width?: DimensionValue;
  height?: number;
  style?: ViewStyle;
}) {
  const C = useColors();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius.sm, backgroundColor: C.skeleton }, animatedStyle, style]}
    />
  );
}
