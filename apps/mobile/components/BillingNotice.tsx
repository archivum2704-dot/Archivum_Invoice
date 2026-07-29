import { View, Text, StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";

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
        { backgroundColor: C.segmentBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
        style,
      ]}
    >
      <Text style={{ fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19 }}>
        {t("common.billingOnWeb")}
      </Text>
    </View>
  );
}
