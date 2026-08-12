import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { FileText, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { Badge, type BadgeTone } from "@/components/ui";
import { fonts } from "@/lib/typography";
import { radius } from "@/lib/radius";
import { spacing } from "@/lib/spacing";

const STATUS_TONE: Record<string, BadgeTone> = {
  paid: "green",
  pending: "yellow",
  overdue: "red",
  draft: "neutral",
  cancelled: "neutral",
};

/**
 * Row for a single document (invoice, quote, delivery note...) in a list —
 * shared by dashboard, biblioteca and buscar so the status badge and layout
 * can't drift between screens.
 */
export function DocRow({ doc, subtitle }: { doc: any; subtitle?: string }) {
  const { t } = useTranslation();
  const C = useColors();
  const tone = STATUS_TONE[doc.status] ?? "neutral";

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/documento/${doc.id}`)}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing.md,
        padding: spacing.md, borderBottomWidth: 1, borderBottomColor: C.border,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
        <FileText size={16} color={C.blue} strokeWidth={1.75} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: fonts.mono, fontWeight: "600", fontSize: 13, color: C.text }} numberOfLines={1}>
            {doc.document_number}
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.text }}>
            {doc.total != null ? `€${Number(doc.total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}` : "—"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3, alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, flex: 1, marginRight: spacing.sm }} numberOfLines={1}>
            {subtitle ?? doc.companies?.name ?? t("common.noCompany")}
          </Text>
          <Badge label={t(`status.${doc.status}`, { defaultValue: doc.status })} tone={tone} />
        </View>
      </View>
      <ChevronRight size={16} color={C.muted} strokeWidth={1.75} />
    </TouchableOpacity>
  );
}
