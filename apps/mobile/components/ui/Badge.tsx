import { Text, View } from "react-native";
import { useColors } from "@/lib/colors";
import { radius } from "@/lib/radius";
import { fonts } from "@/lib/typography";

export type BadgeTone = "blue" | "green" | "yellow" | "red" | "neutral";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const C = useColors();
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    blue: { bg: C.blueL, fg: C.blue },
    green: { bg: C.greenL, fg: C.green },
    yellow: { bg: C.yellowL, fg: C.yellow },
    red: { bg: C.redL, fg: C.red },
    neutral: { bg: C.segmentBg, fg: C.muted },
  };
  const { bg, fg } = map[tone];

  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: fg, letterSpacing: 0.2 }}>{label}</Text>
    </View>
  );
}
