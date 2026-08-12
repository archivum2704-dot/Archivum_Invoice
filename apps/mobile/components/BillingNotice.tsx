import { View, Text, StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";

/**
 * Plan/upgrade guidance shown inside the app.
 *
 * The store builds must not link out to the web checkout: both Apple
 * (guideline 3.1.1) and Google Play restrict linking to external purchase
 * flows for digital services, and that is a common cause of rejection. So we
 * tell the user where to manage their plan instead of opening it.
 */
export function BillingNotice({ style }: { style?: StyleProp<ViewStyle> }) {
  const C = useColors();
  const { t } = useTranslation();
  return (
    <View
      style={[
        { backgroundColor: C.segmentBg, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19 }}>
        {t("common.billingOnWeb")}
      </Text>
    </View>
  );
}
