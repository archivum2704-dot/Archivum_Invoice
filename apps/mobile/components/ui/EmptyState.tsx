import { ReactNode } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";

export function EmptyState({ icon, title, subtitle, action }: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const C = useColors();

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.segmentBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs }}>
        {icon}
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: C.text, textAlign: "center" }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19 }}>
          {subtitle}
        </Text>
      )}
      {action && <View style={{ marginTop: spacing.sm }}>{action}</View>}
    </View>
  );
}
