import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { useColors } from "@/lib/colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Floating "upload document" button, shared by dashboard and biblioteca. */
export function UploadFab() {
  const C = useColors();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={() => router.push("/(app)/subir")}
      onPressIn={() => { scale.value = withTiming(0.92, { duration: 100 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 150 }); }}
      style={[
        animatedStyle,
        {
          position: "absolute", bottom: 20, right: 20,
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: C.blue, alignItems: "center", justifyContent: "center",
          shadowColor: C.blue, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
        },
      ]}
    >
      <Plus size={22} color="#fff" strokeWidth={2} />
    </AnimatedPressable>
  );
}
